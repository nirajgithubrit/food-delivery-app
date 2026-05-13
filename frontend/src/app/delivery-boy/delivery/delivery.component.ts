import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { SocketService } from '../../services/socket.service';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { ToastService } from '../../shared/services/toast.service';
import { LogoutButtonComponent } from '../../shared/ui/logout-button/logout-button.component';
import { directionsOverviewToPath, isIosStandaloneWebApp } from '../../shared/utils/maps-route';

@Component({
  selector: 'app-delivery',
  standalone: true,
  imports: [CommonModule, FormsModule, GoogleMapsModule, LogoutButtonComponent],
  templateUrl: './delivery.component.html',
  styleUrl: './delivery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryComponent implements OnInit, OnDestroy {

  // 📦 STATES
  newOrders: any[] = [];        // 🔥 incoming orders (accept/reject)
  ordersQueue: any[] = [];     // 📦 accepted orders
  currentOrder: any = null;

  // 📍 LOCATIONS
  customer!: { lat: number; lng: number };
  restaurant!: { lat: number; lng: number };
  target!: { lat: number; lng: number };

  // 🗺️ MAP
  center!: google.maps.LatLngLiteral;
  riderPosition!: google.maps.LatLngLiteral;
  directionsResults?: google.maps.DirectionsResult;
  /** iOS home-screen PWA: polyline avoids DirectionsRenderer timing bugs. */
  readonly usePolylineForRoute = isIosStandaloneWebApp();
  routePolylinePath: google.maps.LatLngLiteral[] = [];
  zoom = 15;

  // 📡 TRACKING
  orderId: string | null = null;
  watchId: ReturnType<typeof navigator.geolocation.watchPosition> | undefined;
  isTracking = false;
  isArrived = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private idleWatchId: ReturnType<typeof navigator.geolocation.watchPosition> | undefined;
  private lastIdleApiAt = 0;
  private unwireSocket?: () => void;

  // 👤 PROFILE
  readonly riderName: string = (typeof localStorage !== 'undefined'
    ? localStorage.getItem('deliveryName') || ''
    : '').trim();

  /** Customer PIN — rider asks customer, then enters here before completing. */
  handoffPin = '';

  /** Total visible jobs across all panels — used in header summary chip. */
  get activeCount(): number {
    return (
      this.newOrders.length +
      this.ordersQueue.length +
      (this.currentOrder ? 1 : 0)
    );
  }


  constructor(
    private socket: SocketService,
    private api: ApiService,
    private toast: ToastService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {

    this.startLocationUpdate();

    const myId = this.getRiderId();

    if (myId) {
      this.socket.emit('join-delivery', myId);
    }

    this.socket.onReconnect(() => {
      const rid = this.getRiderId();
      if (rid) {
        this.socket.emit('join-delivery', rid);
      }
      this.wireSocketListeners();
      this.zone.run(() => this.loadAssignedOrders());
    });
    this.wireSocketListeners();

    this.loadAssignedOrders();
    this.refreshTimer = setInterval(() => this.loadAssignedOrders(), 10000);
  }

  private wireSocketListeners(): void {
    this.unwireSocket?.();
    const unsubs: Array<() => void> = [];

    unsubs.push(
      this.socket.subscribeEvent('new-order', (order: any) => {
        this.zone.run(() => {

          if (this.hasAssignee(order)) return;

          if (!this.newOrders.some(o => o._id === order._id)) {
            this.newOrders.push(order);
          }
          this.cdr.detectChanges();
        });
      }),
    );

    unsubs.push(
      this.socket.subscribeEvent('order-updated', (order: any) => {
        this.zone.run(() => {

          const myId = this.getRiderId();

          const status = this.normalizeStatus(order?.status);
          const assigned = this.hasAssignee(order);

          if (!assigned) {
            const id = String(order._id);
            if (status === "delivered" || status === "cancelled" || status === "rejected") {
              this.newOrders = this.newOrders.filter((o) => String(o._id) !== id);
            } else {
              const ix = this.newOrders.findIndex((o) => String(o._id) === id);
              const next = [...this.newOrders];
              if (ix > -1) {
                next[ix] = order;
              } else {
                next.push(order);
              }
              this.newOrders = next;
            }
            this.cdr.detectChanges();
            return;
          }

          if (!myId || String(order.deliveryBoyId).toString() !== myId.toString()) {
            return;
          }

          if (status === "rejected") {
            this.newOrders = this.newOrders.filter((o) => String(o._id) !== String(order._id));
            this.ordersQueue = this.ordersQueue.filter((o) => String(o._id) !== String(order._id));
            if (String(this.orderId) === String(order._id)) {
              this.finishOrder(String(order._id));
            }
            this.cdr.detectChanges();
            return;
          }

          this.newOrders = this.newOrders.filter(o => o._id !== order._id);

          if (status === 'delivered') {
            this.finishOrder(order._id);
            this.cdr.detectChanges();
            return;
          }

          const index = this.ordersQueue.findIndex(o => o._id === order._id);

          if (index > -1) {
            this.ordersQueue[index] = order;
          } else {
            this.ordersQueue.push(order);
          }

          this.syncActiveDeliveryFromQueue();
          this.cdr.detectChanges();
        });
      }),
    );

    unsubs.push(
      this.socket.subscribeEvent('order-removed', (orderId: unknown) => {
        this.zone.run(() => {
          const id = String(orderId);
          this.ordersQueue = this.ordersQueue.filter((o) => String(o._id) !== id);
          if (this.orderId != null && String(this.orderId) === id) {
            this.finishOrder(id);
          }
          this.cdr.detectChanges();
        });
      }),
    );

    this.unwireSocket = () => {
      for (const u of unsubs) u();
    };
  }

  startLocationUpdate() {

    this.clearIdleWatch();

    this.idleWatchId = navigator.geolocation.watchPosition((pos) => {

      const location = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      const now = Date.now();
      if (now - this.lastIdleApiAt < 8000) return;
      this.lastIdleApiAt = now;

      this.zone.run(() => {
        this.api.updateRiderLocation(location).subscribe();
      });

    }, () => undefined, {
      enableHighAccuracy: true
    });
  }

  private clearIdleWatch(): void {
    if (this.idleWatchId != null) {
      navigator.geolocation.clearWatch(this.idleWatchId);
      this.idleWatchId = undefined;
    }
  }

  // 📦 INITIAL LOAD
  loadAssignedOrders() {

    this.api.getMyDeliveryOrders().subscribe({
      next: (orders: any) => {
        this.zone.run(() => {
        const list = this.normalizeOrders(orders);
        const myId = this.getRiderId();

        // ✅ 1. LOAD NEW ORDERS (UNASSIGNED)
        this.newOrders = list.filter((o: any) => !this.hasAssignee(o));

        // ✅ 2. LOAD MY ASSIGNED ORDERS
        this.ordersQueue = list.filter((o: any) => {
          const status = this.normalizeStatus(o?.status);
          const active = status !== 'delivered' && status !== 'cancelled' && status !== 'rejected';
          if (!active || !this.hasAssignee(o)) return false;
          if (!myId) return true;
          return String(o.deliveryBoyId) === myId;
        });

        // ✅ 3. Active delivery = newest in-progress job (not first in list — avoids stale map when 2+ dispatched).
        this.syncActiveDeliveryFromQueue();

        this.cdr.detectChanges();
        });
      },
      error: (err) => {
        const msg = err.error?.error?.message ?? err.message ?? 'Could not refresh delivery orders';
        this.toast.error(msg);
      }
    });
  }

  // ✅ ACCEPT ORDER
  acceptOrder(order: any) {

    const deliveryBoyId = this.getRiderId();
    if (!deliveryBoyId) {
      this.toast.error('Rider session is missing. Please sign in again.');
      return;
    }

    const orderId = order?._id != null ? String(order._id) : '';
    if (!orderId) return;

    this.api.assignDelivery(orderId, deliveryBoyId).subscribe({
      next: () => {
        this.newOrders = this.newOrders.filter(o => String(o._id) !== orderId);
      },
      error: (err) => {
        const msg = err.error?.error?.message ?? err.message ?? 'Accept failed';
        console.error('[acceptOrder] API error', err);
        this.toast.error(msg);
      },
    });
  }

  // ❌ REJECT ORDER
  rejectOrder(order: any) {
    this.api.rejectOrder(order._id).subscribe();
    this.newOrders = this.newOrders.filter(o => o._id !== order._id);
  }

  // 🚀 START ORDER
  startOrder(order: any) {

    this.clearIdleWatch();

    this.currentOrder = order;
    this.orderId = order._id;

    this.socket.emit('join-order', this.orderId);

    this.customer = order.location;
    this.restaurant = order.restaurantLocation;

    // 🔥 PHASE
    if (['accepted', 'preparing', 'ready_for_pickup', 'assigned'].includes(this.normalizeStatus(order.status))) {
      this.target = this.restaurant;
    } else {
      this.target = this.customer;
    }

    this.riderPosition = order.deliveryLocation || this.restaurant;
    this.center = this.riderPosition;

    this.updateRoute();

    if (!this.isTracking) {
      this.startTracking();
    }
  }

  get routePolylineOptions(): google.maps.PolylineOptions {
    return {
      path: this.routePolylinePath,
      strokeColor: "#2563eb",
      strokeWeight: 4,
      strokeOpacity: 1,
      geodesic: true,
    };
  }

  // 🛣️ ROUTE
  updateRoute() {

    const service = new google.maps.DirectionsService();

    service.route({
      origin: this.riderPosition,
      destination: this.target,
      travelMode: google.maps.TravelMode.DRIVING
    }, (res, status) => {
      this.zone.run(() => {
        if (status === "OK" && res) {
          this.directionsResults = res;
          this.routePolylinePath = directionsOverviewToPath(res);
        } else {
          this.routePolylinePath = [];
        }
        this.cdr.markForCheck();
      });
    });
  }

  // 📡 LIVE GPS
  startTracking() {

    if (!this.orderId || this.isTracking) return;

    this.isTracking = true;

    let lastRouteUpdate = 0;
    let lastSocketEmit = 0;
    let lastRestApi = 0;

    this.watchId = navigator.geolocation.watchPosition(

      (pos) => {

        const current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };

        const now = Date.now();
        if (now - lastRestApi > 8000) {
          lastRestApi = now;
          this.api.updateRiderLocation({
            lat: current.lat,
            lng: current.lng
          }).subscribe();
        }

        this.riderPosition = current;
        this.center = current;

        if (now - lastSocketEmit > 700) {
          lastSocketEmit = now;
          this.socket.emit('send-location', {
            orderId: this.orderId,
            lat: current.lat,
            lng: current.lng
          });
        }

        if (now - lastRouteUpdate > 3000) {
          this.updateRoute();
          lastRouteUpdate = now;
        }

        const distance = this.getDistance(current, this.target);
        // ~300m threshold in degrees (lat/lng); was 0.001 (~100m) and often never fired on real devices.
        const isNear = distance < 0.003;

        if (
          isNear &&
          this.normalizeStatus(this.currentOrder.status) === 'out_for_delivery'
        ) {
          if (!this.isArrived) {
            this.isArrived = true;
            this.cdr.markForCheck();
          }
        }

      },
      () => undefined,
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 5000
      }
    );
  }

  markPicked() {
    if (!this.orderId) return;

    this.api.updatePickupStatus(this.orderId).subscribe(() => {
      this.currentOrder = { ...this.currentOrder, status: "out_for_delivery" };

      this.target = this.customer;
      this.updateRoute();
    });
  }

  confirmUpiReceived() {
    if (!this.orderId) return;
    this.api.verifyPayment(this.orderId).subscribe({
      next: (order: any) => {
        if (this.currentOrder && String(this.currentOrder._id) === String(order._id)) {
          this.currentOrder = { ...this.currentOrder, ...order };
        }
      },
      error: (err) => {
        const msg = err.error?.error?.message ?? err.message ?? 'Verification failed';
        this.toast.error(msg);
      },
    });
  }

  // ✅ COMPLETE ORDER
  completeOrder() {

    if (!this.orderId || !this.currentOrder) return;

    if (
      this.currentOrder.paymentMethod === 'upi' &&
      this.currentOrder.paymentStatus !== 'verified'
    ) {
      this.toast.info('Confirm UPI payment before completing the order.');
      return;
    }

    const raw = (this.handoffPin || "").trim().replace(/\D/g, "");
    if (raw.length > 0 && (raw.length < 4 || raw.length > 6)) {
      this.toast.error("PIN must be 4–6 digits.");
      return;
    }
    const payload =
      raw.length >= 4
        ? ({ status: "delivered" as const, deliveryPin: raw })
        : ({ status: "delivered" as const });

    this.api.updateOrder(this.orderId, payload).subscribe({
      next: () => {
        this.handoffPin = "";
        this.finishOrder(this.orderId!);
      },
      error: (err) => {
        const msg = err.error?.error?.message ?? err.message ?? 'Could not complete order';
        this.toast.error(msg);
      },
    });
  }

  // 🔄 FINISH
  finishOrder(orderId: string) {

    this.isArrived = false
    this.handoffPin = '';
    this.stopTracking();

    this.ordersQueue = this.ordersQueue.filter(o => String(o._id) !== String(orderId));

    this.currentOrder = null;
    this.orderId = null;

    // If another job is already in progress, switch map/details to it immediately.
    this.syncActiveDeliveryFromQueue();
  }

  private readonly riderMapStatuses = new Set([
    "accepted",
    "preparing",
    "ready_for_pickup",
    "assigned",
    "picked_up",
    "out_for_delivery",
  ]);

  /**
   * Oldest assigned job first (FIFO). Stays on the first in-flight order until it is
   * delivered, even if a newer order is also dispatched — avoids losing map/details for
   * the order the rider is actually finishing.
   */
  private pickPrimaryWorkOrder(queue: any[], myId: string | null): any | null {
    if (!myId) return null;
    const list = queue.filter(
      (o) =>
        String(o.deliveryBoyId) === myId &&
        this.riderMapStatuses.has(this.normalizeStatus(o?.status)) &&
        o?.location &&
        o?.restaurantLocation,
    );
    if (!list.length) return null;
    list.sort((a, b) => {
      const ta = this.orderCreatedMs(a);
      const tb = this.orderCreatedMs(b);
      if (ta !== tb) return ta - tb;
      return String(a._id).localeCompare(String(b._id));
    });
    return list[0];
  }

  private orderCreatedMs(o: any): number {
    const raw = o?.createdAt ?? o?.created_at;
    if (raw == null) return 0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  private syncActiveDeliveryFromQueue(): void {
    const myId = this.getRiderId();
    const primary = this.pickPrimaryWorkOrder(this.ordersQueue, myId);

    if (primary) {
      const id = String(primary._id);
      if (!this.currentOrder || String(this.currentOrder._id) !== id) {
        this.startOrder(primary);
      } else {
        this.currentOrder = { ...this.currentOrder, ...primary };
        this.customer = primary.location;
        this.restaurant = primary.restaurantLocation;
        this.target =
          ['accepted', 'preparing', 'ready_for_pickup', 'assigned'].includes(this.normalizeStatus(primary.status))
            ? this.restaurant
            : this.customer;
        this.updateRoute();
      }
      return;
    }

    if (this.currentOrder) {
      const stillInProgress = this.ordersQueue.some(
        (o) =>
          String(o._id) === String(this.currentOrder._id) &&
          this.riderMapStatuses.has(this.normalizeStatus(o.status)),
      );
      if (!stillInProgress) {
        this.isArrived = false;
        this.handoffPin = "";
        this.stopTracking();
        this.currentOrder = null;
        this.orderId = null;
      }
    }
  }

  // 🛑 STOP
  stopTracking(resumeIdle = true) {

    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = undefined;
    }

    this.isTracking = false;
    if (resumeIdle) {
      this.startLocationUpdate();
    }
  }

  getDistance(a: any, b: any) {
    const dx = a.lat - b.lat;
    const dy = a.lng - b.lng;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private normalizeOrders(payload: any): any[] {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  private normalizeStatus(status: unknown): string {
    return String(status ?? '').trim().toLowerCase();
  }

  private hasAssignee(order: any): boolean {
    const raw = order?.deliveryBoyId;
    if (raw == null) return false;
    const val = String(raw).trim().toLowerCase();
    return val !== '' && val !== 'null' && val !== 'undefined';
  }

  private getRiderId(): string | null {
    const fromLocal = localStorage.getItem('deliveryUser');
    if (fromLocal) return fromLocal;

    const token = sessionStorage.getItem('authToken');
    if (!token) return null;

    try {
      const base64 = token.split('.')[1];
      if (!base64) return null;
      const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(json);
      return payload?.id ? String(payload.id) : null;
    } catch {
      return null;
    }
  }

  ngOnDestroy() {
    this.clearIdleWatch();
    this.stopTracking(false);
    this.unwireSocket?.();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}