import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ApiService } from "../../services/api.service";
import { SocketService } from "../../services/socket.service";
import { NotificationSoundService } from "../../shared/services/notification-sound.service";
import { ToastService } from "../../shared/services/toast.service";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { GoogleMapsModule } from "@angular/google-maps";
import { UiCardComponent } from "../../shared/ui/ui-card/ui-card.component";
import { UiSkeletonComponent } from "../../shared/ui/ui-skeleton/ui-skeleton.component";
import { directionsOverviewToPath } from "../../shared/utils/maps-route";
import { CustomerOrdersStore, CustomerOrder } from "../services/customer-orders.store";

@Component({
  selector: "app-order-tracking",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    GoogleMapsModule,
    UiCardComponent,
    UiSkeletonComponent,
  ],
  templateUrl: "./order-tracking.component.html",
  styleUrl: "./order-tracking.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "order-track-root" },
})
export class OrderTrackingComponent {
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);
  private readonly zone = inject(NgZone);
  private readonly toast = inject(ToastService);
  private readonly notifySound = inject(NotificationSoundService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersStore = inject(CustomerOrdersStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly order = this.ordersStore.selectedTrackingOrder;
  readonly loading = this.ordersStore.loadingTracking;
  readonly socketConnected = this.socket.connected;

  center = signal<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });
  markerPosition = signal<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });
  /** Zoom level for `<google-map>`; signal so OnPush updates when we fit bounds. */
  readonly mapZoom = signal(15);

  directionsResults = signal<google.maps.DirectionsResult | undefined>(
    undefined,
  );
  readonly routePolylinePath = signal<google.maps.LatLngLiteral[]>([]);

  readonly polylineOptions = computed(
    (): google.maps.PolylineOptions => ({
      path: this.routePolylinePath(),
      strokeColor: "#2563eb",
      strokeWeight: 4,
      strokeOpacity: 1,
      geodesic: true,
    }),
  );

  eta = signal("");
  customerLocation = signal<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });
  restaurantLocation = signal<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });

  readonly steps = [
    { key: "pending", label: "Order placed" },
    { key: "accepted", label: "Restaurant accepted" },
    { key: "preparing", label: "Preparing your meal" },
    { key: "out_for_delivery", label: "Out for delivery" },
    { key: "delivered", label: "Delivered" },
  ] as const;

  isNear = signal(false);
  private prevStatus = "";
  private prevPickupStatus = "";
  private prevRiderId: string | null = null;

  private lastJoinedOrderId = "";
  private lastDeliveryCoordsKey = "";
  private routeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private markerAnimFrame: number | null = null;

  readonly mapUiOptions: google.maps.MapOptions = {
    mapTypeId: google.maps.MapTypeId?.ROADMAP ?? "roadmap",
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: "greedy",
    styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
  };

  bikeIcon: google.maps.Icon = {
    url: "bike_icon.png",
    scaledSize: new google.maps.Size(45, 45),
    anchor: new google.maps.Point(22, 22),
  };

  readonly currentStepIndex = computed(() => this.getStepIndex(this.order()?.status));

  readonly hasFooter = computed(() => {
    const o = this.order();
    return !!o && o.status !== "rejected" && o.status !== "cancelled" && o.status !== "delivered";
  });

  readonly isDelivered = computed(() => this.order()?.status === "delivered");

  clearSavedOrder(): void {
    try {
      localStorage.removeItem("orderId");
    } catch {
      /* no-op */
    }
  }

  /** Avoid routerLink + double navigation delay; clears saved order id before route change. */
  goToMenu(ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.clearSavedOrder();
    void this.router.navigateByUrl("/customer/menu", { replaceUrl: true });
  }

  readonly riderName = computed(() => {
    const o = this.order();
    if (!o) return "Awaiting partner";
    const name = o?.deliveryBoy?.name?.trim();
    if (name) return name;
    if (o.deliveryBoyId) return "Delivery partner";
    return "Searching for rider…";
  });

  readonly showHandoffPin = computed(() => {
    const o = this.order();
    if (!o?.deliveryPin || !o?.deliveryBoyId) return false;
    if (o.status === "delivered" || o.status === "cancelled" || o.status === "rejected") return false;
    return true;
  });

  readonly riderPhone = computed(() => this.order()?.deliveryBoy?.phone || "");

  readonly showRestaurantCall = computed(() => {
    const o = this.order();
    if (!o) return false;
    if (o.status === "delivered" || o.status === "cancelled" || o.status === "rejected") return false;
    return ["accepted", "preparing", "ready_for_pickup", "assigned"].includes(String(o.status));
  });

  private readonly unsubSocketOrderSideEffects: () => void;

  private readonly mapSyncEffect = effect(
    () => {
      const o = this.order();
      if (!o?._id || !o.location || !o.restaurantLocation) return;

      const id = String(o._id);
      if (id !== this.lastJoinedOrderId) {
        this.lastJoinedOrderId = id;
        this.lastDeliveryCoordsKey = "";
        this.prevStatus = o.status ?? "";
        this.prevPickupStatus = o.pickupStatus ?? "";
        this.prevRiderId = o.deliveryBoyId ?? null;
        this.socket.emit("join-order", id);
      }

      const cust = this.toLatLng(o.location);
      const rest = this.toLatLng(o.restaurantLocation);
      if (!cust || !rest) return;

      this.customerLocation.set(cust);
      this.restaurantLocation.set(rest);

      if (o.status === "rejected") {
        this.clearRouteDebounce();
        this.eta.set("");
        this.directionsResults.set(undefined);
        this.routePolylinePath.set([]);
        return;
      }

      const rider = o.deliveryLocation != null ? this.toLatLng(o.deliveryLocation) : null;

      const markerGoal = rider ?? rest;
      const deliveryKey = rider
        ? `${rider.lat.toFixed(5)},${rider.lng.toFixed(5)}`
        : "";
      const riderMoved =
        !!rider && deliveryKey !== this.lastDeliveryCoordsKey;
      if (rider) {
        this.lastDeliveryCoordsKey = deliveryKey;
      }
      this.setMarkerAnimated(markerGoal, riderMoved);

      const routeTarget = this.routeDestinationForStatus(String(o.status));
      this.scheduleDebouncedRoute(markerGoal, routeTarget, id);

      if (!rider) {
        const dist = this.getDistance(markerGoal, routeTarget);
        this.isNear.set(dist < 0.005);
      }
    },
    { allowSignalWrites: true },
  );

  /** True when the customer has two or more active orders — show back to the list. */
  readonly showMultiOrderBack = computed(
    () => this.ordersStore.activeOrders().length >= 2,
  );

  constructor() {
    this.ordersStore.loadActiveOrders();

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const orderId = params.get("orderId");
      if (!orderId) return;
      this.loadOrder(orderId);
    });

    this.unsubSocketOrderSideEffects = this.socket.subscribeEvent<CustomerOrder>(
      "order-updated",
      (data) => {
        if (String(data._id) !== String(this.order()?._id)) return;

        const statusChanged = this.prevStatus !== data.status;
        const pickupChanged = this.prevPickupStatus !== data.pickupStatus;
        const riderChanged =
          String(this.prevRiderId ?? "") !== String(data.deliveryBoyId ?? "");

        if (data.status === "rejected" && statusChanged) {
          this.toast.error(
            "This order was declined by the restaurant. You have not been charged.",
          );
        } else if (statusChanged || pickupChanged) {
          this.notifySound.play();
        }

        this.prevStatus = String(data.status ?? "");
        this.prevPickupStatus = String(data.pickupStatus ?? "");
        this.prevRiderId = data.deliveryBoyId ?? null;

        if (riderChanged && data.deliveryBoyId) {
          this.refreshOrderEnrichment();
        }
      },
    );

    this.destroyRef.onDestroy(() => {
      this.clearRouteDebounce();
      this.cancelMarkerAnim();
      this.unsubSocketOrderSideEffects();
    });
  }

  loadOrder(orderId: string): void {
    this.ordersStore.loadOrderById(orderId);
  }

  private refreshOrderEnrichment(): void {
    const currentId = this.order()?._id;
    if (!currentId) return;

    this.api.getCustomerOrderById(String(currentId)).subscribe({
      next: (fresh: unknown) => {
        if (!fresh || typeof fresh !== "object") return;
        this.ordersStore.patchSelectedOrder(fresh as CustomerOrder);
      },
    });
  }

  getStepIndex(status: string | undefined): number {
    if (!status || status === "rejected" || status === "cancelled") return -1;
    if (status === "pending") return 0;
    if (status === "accepted") return 1;
    if (["preparing", "ready_for_pickup", "assigned", "picked_up"].includes(status)) return 2;
    if (status === "out_for_delivery") return 3;
    if (status === "delivered") return 4;
    return 0;
  }

  statusLabel(o: { status?: string } | null): string {
    if (!o) return "";
    switch (o.status) {
      case "pending":
        return "Pending";
      case "accepted":
        return "Confirmed";
      case "preparing":
      case "ready_for_pickup":
      case "assigned":
      case "picked_up":
        return "Preparing";
      case "out_for_delivery":
        return "On the way";
      case "delivered":
        return "Delivered";
      case "rejected":
        return "Declined";
      case "cancelled":
        return "Cancelled";
      default:
        return "Updating";
    }
  }

  statusHint(o: { status?: string } | null): string {
    if (!o) return "";
    switch (o.status) {
      case "pending":
        return "Waiting for the restaurant to confirm…";
      case "accepted":
        return "Accepted. A rider will pick up your order soon.";
      case "preparing":
      case "ready_for_pickup":
      case "assigned":
      case "picked_up":
        return "Your order is being prepared for dispatch.";
      case "out_for_delivery":
        return "Rider is bringing your order to you.";
      case "delivered":
        return "Delivered. Enjoy your meal!";
      case "cancelled":
        return "This order was cancelled.";
      default:
        return "Updating…";
    }
  }

  private routeDestinationForStatus(status: string): google.maps.LatLngLiteral {
    if (
      ["accepted", "preparing", "ready_for_pickup", "assigned", "picked_up"].includes(
        status,
      )
    ) {
      return this.restaurantLocation();
    }
    return this.customerLocation();
  }

  private scheduleDebouncedRoute(
    origin: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral,
    orderKey: string,
  ): void {
    this.clearRouteDebounce();
    this.routeDebounceTimer = setTimeout(() => {
      this.routeDebounceTimer = null;
      if (String(this.order()?._id) !== orderKey) return;
      this.getRoute(origin, destination);
    }, 450);
  }

  private clearRouteDebounce(): void {
    if (this.routeDebounceTimer != null) {
      clearTimeout(this.routeDebounceTimer);
      this.routeDebounceTimer = null;
    }
  }

  getRoute(
    origin: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral,
  ): void {
    if (this.getDistance(origin, destination) < 1e-7) {
      this.zone.run(() => {
        this.directionsResults.set(undefined);
        this.routePolylinePath.set([]);
        this.eta.set("—");
        this.applyViewportFit([origin]);
      });
      return;
    }

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        this.zone.run(() => {
          if (status === "OK" && result) {
            this.directionsResults.set(result);
            const path = directionsOverviewToPath(result);
            this.routePolylinePath.set(path);
            const leg = result.routes[0].legs[0];
            this.eta.set(leg.duration?.text || "");

            const rider = this.markerPosition();
            const target = this.routeDestinationForStatus(String(this.order()?.status ?? ""));
            const distance = this.getDistance(rider, target);
            this.isNear.set(distance < 0.005);
            if (path.length) {
              this.applyViewportFit(path);
            }
          } else {
            this.directionsResults.set(undefined);
            this.routePolylinePath.set([origin, destination]);
            this.eta.set("—");
            this.applyViewportFit([origin, destination, this.markerPosition()]);
          }
        });
      },
    );
  }

  private toLatLng(
    raw: { lat?: unknown; lng?: unknown } | null | undefined,
  ): google.maps.LatLngLiteral | null {
    if (!raw) return null;
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  private applyViewportFit(points: google.maps.LatLngLiteral[]): void {
    const list = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!list.length) return;
    let latMin = list[0].lat;
    let latMax = list[0].lat;
    let lngMin = list[0].lng;
    let lngMax = list[0].lng;
    for (const p of list) {
      latMin = Math.min(latMin, p.lat);
      latMax = Math.max(latMax, p.lat);
      lngMin = Math.min(lngMin, p.lng);
      lngMax = Math.max(lngMax, p.lng);
    }
    const latSpan = Math.max(0.0009, latMax - latMin);
    const lngSpan = Math.max(0.0009, lngMax - lngMin);
    const span = Math.max(latSpan, lngSpan);
    this.center.set({
      lat: (latMin + latMax) / 2,
      lng: (lngMin + lngMax) / 2,
    });
    const z = Math.min(17, Math.max(11, Math.round(15 - Math.log10(span * 110))));
    this.mapZoom.set(z);
  }

  private setMarkerAnimated(
    goal: google.maps.LatLngLiteral,
    smooth: boolean,
  ): void {
    if (!smooth) {
      this.cancelMarkerAnim();
      this.markerPosition.set(goal);
      this.center.set(goal);
      return;
    }

    const from = this.markerPosition();
    if (from.lat === 0 && from.lng === 0) {
      this.markerPosition.set(goal);
      this.center.set(goal);
      return;
    }

    this.cancelMarkerAnim();
    const startTime = performance.now();
    const durationMs = 380;

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const u = t * t * (3 - 2 * t);
      this.markerPosition.set({
        lat: from.lat + (goal.lat - from.lat) * u,
        lng: from.lng + (goal.lng - from.lng) * u,
      });
      this.center.set(this.markerPosition());
      if (t < 1) {
        this.markerAnimFrame = requestAnimationFrame((ts) => step(ts));
      } else {
        this.markerAnimFrame = null;
      }
    };
    this.markerAnimFrame = requestAnimationFrame((ts) => step(ts));
  }

  private cancelMarkerAnim(): void {
    if (this.markerAnimFrame != null) {
      cancelAnimationFrame(this.markerAnimFrame);
      this.markerAnimFrame = null;
    }
  }

  getDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const dx = a.lat - b.lat;
    const dy = a.lng - b.lng;
    return Math.sqrt(dx * dx + dy * dy);
  }

}
