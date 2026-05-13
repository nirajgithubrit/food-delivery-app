import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
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
  styleUrl: './delivery.component.scss'
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
  watchId: any;
  isTracking = false;
  isArrived = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly reconnectHandler = () => this.loadAssignedOrders();

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

    console.log('🚚 Delivery Dashboard Loaded');
    this.startLocationUpdate();

    const myId = this.getRiderId();

    if (myId) {
      this.socket.emit('join-delivery', myId);
    }
    this.socket.socket.on('connect', this.reconnectHandler);

    // 🧹 CLEAN OLD LISTENERS
    this.socket.off('new-order');
    this.socket.off('order-updated');
    this.socket.off('order-removed');

    // 🔥 NEW ORDER COMING (ASSIGN)
    this.socket.listen('new-order', (order: any) => {
      this.zone.run(() => {

        // ❌ if already assigned → ignore
        if (this.hasAssignee(order)) return;

        if (!this.newOrders.some(o => o._id === order._id)) {
          this.newOrders.push(order);
        }
        this.cdr.detectChanges();
      });
    });

    // 🔥 ORDER UPDATE
    this.socket.listen('order-updated', (order: any) => {
      this.zone.run(() => {

        const myId = this.getRiderId();

      // ===============================
      // 🔥 CASE 1: NOT ASSIGNED (POOL ORDERS)
      // ===============================
        const status = this.normalizeStatus(order?.status);
        const assigned = this.hasAssignee(order);

        if (!assigned) {
          const id = String(order._id);
          if (status === "completed" || status === "rejected") {
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

      // ===============================
      // ❌ CASE 2: ASSIGNED TO OTHER RIDER
      // ===============================
        if (!myId || String(order.deliveryBoyId).toString() !== myId.toString()) {
          return;
        }

      // Assigned to me but cancelled/rejected by restaurant
        if (status === "rejected") {
          this.newOrders = this.newOrders.filter((o) => String(o._id) !== String(order._id));
          this.ordersQueue = this.ordersQueue.filter((o) => String(o._id) !== String(order._id));
          if (String(this.orderId) === String(order._id)) {
            this.finishOrder(String(order._id));
          }
          this.cdr.detectChanges();
          return;
        }

      // remove from new orders
        this.newOrders = this.newOrders.filter(o => o._id !== order._id);

      // remove completed
        if (status === 'completed') {
          this.finishOrder(order._id);
          this.cdr.detectChanges();
          return;
        }

      // update queue
        const index = this.ordersQueue.findIndex(o => o._id === order._id);

        if (index > -1) {
          this.ordersQueue[index] = order;
        } else {
          this.ordersQueue.push(order);
        }

      // start tracking only for MY order
        if (status === 'inprogress') {
          this.startOrder(order);
        }
        this.cdr.detectChanges();
      });
    });

    // ORDER REMOVED
    this.socket.listen('order-removed', (orderId: unknown) => {
      this.zone.run(() => {
        const id = String(orderId);
        // Keep pool stable: only remove from "new orders" if not present in latest API load.
        // Avoid flicker where transient remove events hide valid unassigned offers.
        this.ordersQueue = this.ordersQueue.filter((o) => String(o._id) !== id);
        if (this.orderId != null && String(this.orderId) === id) {
          this.finishOrder(id);
        }
        this.cdr.detectChanges();
      });
    });

    this.loadAssignedOrders();
    this.refreshTimer = setInterval(() => this.loadAssignedOrders(), 10000);
  }

  //Starting Location 
  startLocationUpdate() {

    navigator.geolocation.watchPosition((pos) => {

      const location = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      console.log('📍 Updating rider location:', location);

      this.api.updateRiderLocation(location).subscribe();

    }, (err) => console.error(err), {
      enableHighAccuracy: true
    });
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
          const active = status !== 'completed' && status !== 'rejected';
          if (!active || !this.hasAssignee(o)) return false;
          if (!myId) return true;
          return String(o.deliveryBoyId) === myId;
        });

        // ✅ 3. START ACTIVE ORDER
        const active = this.ordersQueue.find((o: any) => this.normalizeStatus(o?.status) === 'inprogress');
        if (active) {
          this.startOrder(active);
        } else if (this.currentOrder) {
          const stillActive = this.ordersQueue.some(
            (o: any) => String(o._id) === String(this.currentOrder?._id)
          );
          if (!stillActive) {
            this.finishOrder(String(this.currentOrder._id));
          }
        }

        console.log(
          '[delivery] api list',
          list.length,
          list.map((o: any) => ({
            id: o?._id,
            status: o?.status,
            deliveryBoyId: o?.deliveryBoyId
          }))
        );
        console.log('[delivery] newOrders', this.newOrders.length);
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

    console.log('✅ Accepted:', orderId, 'rider:', deliveryBoyId);

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

    this.currentOrder = order;
    this.orderId = order._id;

    this.socket.emit('join-order', this.orderId);

    this.customer = order.location;
    this.restaurant = order.restaurantLocation;

    // 🔥 PHASE
    if (order.pickupStatus === 'pending') {
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
    let isPicked = false;
    let isCompleted = false;

    this.watchId = navigator.geolocation.watchPosition(

      (pos) => {

        const current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };

        this.api.updateRiderLocation({
          lat: current.lat,
          lng: current.lng
        }).subscribe();

        this.riderPosition = current;
        this.center = current;

        // 📡 SEND TO SERVER
        this.socket.emit('send-location', {
          orderId: this.orderId,
          lat: current.lat,
          lng: current.lng
        });

        // 🛣️ LIMIT ROUTE UPDATE (every 3 sec)
        const now = Date.now();
        if (now - lastRouteUpdate > 3000) {
          this.updateRoute();
          lastRouteUpdate = now;
        }

        const distance = this.getDistance(current, this.target);
        console.log('📏 Distance:', distance);
        const isNear = distance < 0.001; // 🔥 increased threshold

        if (
          isNear &&
          this.currentOrder.pickupStatus === 'picked'
        ) {
          this.isArrived = true;
        }

      },
      (err) => console.error(err),
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
      this.currentOrder.pickupStatus = 'picked';

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
        ? ({ status: "completed" as const, deliveryPin: raw })
        : ({ status: "completed" as const });

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
  }

  // 🛑 STOP
  stopTracking() {

    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    this.isTracking = false;
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
    this.stopTracking();
    this.socket.socket.off('connect', this.reconnectHandler);
    this.socket.off('order-updated');
    this.socket.off('new-order');
    this.socket.off('order-removed');
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}