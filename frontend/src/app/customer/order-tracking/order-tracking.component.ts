import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { ApiService } from "../../services/api.service";
import { SocketService } from "../../services/socket.service";
import { NotificationSoundService } from "../../shared/services/notification-sound.service";
import { ToastService } from "../../shared/services/toast.service";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { GoogleMapsModule } from "@angular/google-maps";
import { UiCardComponent } from "../../shared/ui/ui-card/ui-card.component";
import { UiSkeletonComponent } from "../../shared/ui/ui-skeleton/ui-skeleton.component";
import {
  directionsOverviewToPath,
  isIosStandaloneWebApp,
} from "../../shared/utils/maps-route";

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
export class OrderTrackingComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);
  private readonly zone = inject(NgZone);
  private readonly toast = inject(ToastService);
  private readonly notifySound = inject(NotificationSoundService);

  readonly order = signal<any | null>(null);
  readonly loading = signal(true);

  center = signal<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });
  markerPosition = signal<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });
  zoom = 15;

  directionsResults = signal<google.maps.DirectionsResult | undefined>(
    undefined,
  );
  /** On iOS installed PWA, draw the route with a polyline (DirectionsRenderer sync issues). */
  readonly usePolylineForRoute = isIosStandaloneWebApp();
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
    { key: "confirmed", label: "Restaurant accepted" },
    { key: "preparing", label: "Preparing your meal" },
    { key: "pickup", label: "Picked by rider" },
    { key: "completed", label: "Delivered" },
  ] as const;

  isNear = signal(false);
  private prevStatus = "";
  private prevPickupStatus = "";
  private prevRiderId: string | null = null;

  readonly mapUiOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
  };

  bikeIcon: google.maps.Icon = {
    url: "bike_icon.png",
    scaledSize: new google.maps.Size(45, 45),
    anchor: new google.maps.Point(22, 22),
  };

  /** Current step index for the timeline, exposed for templates that can't see the `as` alias. */
  readonly currentStepIndex = computed(() => this.getStepIndex(this.order()?.status));

  /** Footer with rider details only makes sense for active orders (not rejected, not completed). */
  readonly hasFooter = computed(() => {
    const o = this.order();
    return !!o && o.status !== "rejected" && o.status !== "completed";
  });

  /** True once the order is marked delivered. */
  readonly isDelivered = computed(() => this.order()?.status === "completed");

  /** Clear the saved order id so refreshing returns to the menu cleanly. */
  clearSavedOrder(): void {
    try {
      localStorage.removeItem("orderId");
    } catch {
      /* no-op */
    }
  }

  /** Rider's display name with sensible fallback. */
  readonly riderName = computed(() => {
    const o = this.order();
    if (!o) return "Awaiting partner";
    const name = o?.deliveryBoy?.name?.trim();
    if (name) return name;
    if (o.deliveryBoyId) return "Delivery partner";
    return "Searching for rider…";
  });

  /** Show handoff PIN once a rider is assigned (customer shares verbally at the door). */
  readonly showHandoffPin = computed(() => {
    const o = this.order();
    if (!o?.deliveryPin || !o?.deliveryBoyId) return false;
    if (o.status === "completed" || o.status === "rejected") return false;
    return true;
  });

  /** Rider phone for tel: link (empty string when unknown). */
  readonly riderPhone = computed(() => this.order()?.deliveryBoy?.phone || "");

  /** Show restaurant call card before pickup happens. */
  readonly showRestaurantCall = computed(() => {
    const o = this.order();
    if (!o) return false;
    if (o.status === "completed" || o.status === "rejected") return false;
    return o.pickupStatus !== "picked";
  });

  ngOnInit(): void {
    this.socket.listen("order-updated", (data: any) => {
      if (String(data._id) !== String(this.order()?._id)) return;

      const statusChanged = this.prevStatus !== data.status;
      const pickupChanged = this.prevPickupStatus !== data.pickupStatus;
      const riderChanged =
        String(this.prevRiderId ?? "") !== String(data.deliveryBoyId ?? "");

      if (data.status === "rejected" && statusChanged) {
        this.toast.error(
          "This order was declined by the restaurant. You have not been charged.",
        );
        this.eta.set("");
        this.directionsResults.set(undefined);
        this.routePolylinePath.set([]);
      } else if (statusChanged || pickupChanged) {
        this.notifySound.play();
      }

      this.prevStatus = data.status;
      this.prevPickupStatus = data.pickupStatus;
      this.prevRiderId = data.deliveryBoyId ?? null;

      // Rider name/phone still come from /orders/me enrichment; restaurant
      // name/phone are on the order document once persisted.
      const prev = this.order();
      this.order.set({
        ...data,
        deliveryBoy: data.deliveryBoy ?? prev?.deliveryBoy ?? null,
        restaurantName: data.restaurantName || prev?.restaurantName,
        restaurantPhone: data.restaurantPhone || prev?.restaurantPhone,
        deliveryPin: data.deliveryPin ?? prev?.deliveryPin,
      });

      // Rider just got assigned (or changed) — refetch to pick up rider name/phone.
      if (riderChanged && data.deliveryBoyId) {
        this.refreshOrderEnrichment();
      }
    });

    this.socket.listen("location-update", (ord: any) => {
      if (
        String(ord?._id) !== String(this.order()?._id) ||
        !ord?.deliveryLocation ||
        this.order()?.status === "rejected"
      ) {
        return;
      }

      const rider = {
        lat: ord.deliveryLocation.lat,
        lng: ord.deliveryLocation.lng,
      };

      this.markerPosition.set(rider);
      this.center.set(rider);

      const target =
        ord.pickupStatus === "pending"
          ? this.restaurantLocation()
          : this.customerLocation();

      const distance = this.getDistance(rider, target);
      this.isNear.set(distance < 0.005);

      this.getRoute(rider, target);
    });

    this.loadOrder();
  }

  loadOrder(): void {
    this.loading.set(true);
    this.api.getCustomerOrders().subscribe({
      next: (orders: any[]) => {
        const savedId = localStorage.getItem("orderId");
        const match = savedId
          ? orders?.find((o) => String(o._id) === String(savedId))
          : undefined;
        const o = match ?? orders?.[0] ?? null;
        this.order.set(o);
        if (!o) {
          this.loading.set(false);
          return;
        }

        this.prevStatus = o.status ?? "";
        this.prevPickupStatus = o.pickupStatus ?? "";
        this.prevRiderId = o.deliveryBoyId ?? null;

        this.socket.emit("join-order", o._id);

        this.customerLocation.set({
          lat: o.location.lat,
          lng: o.location.lng,
        });
        this.restaurantLocation.set({
          lat: o.restaurantLocation.lat,
          lng: o.restaurantLocation.lng,
        });

        if (o.status === "rejected") {
          this.eta.set("");
          this.directionsResults.set(undefined);
          this.routePolylinePath.set([]);
        } else {
          const start = o.deliveryLocation || this.restaurantLocation();
          this.markerPosition.set(start);
          this.center.set(start);
          this.getRoute(start, this.restaurantLocation());
        }

        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Re-fetch order list quietly to update enriched rider info after assignment. */
  private refreshOrderEnrichment(): void {
    const currentId = this.order()?._id;
    if (!currentId) return;

    this.api.getCustomerOrders().subscribe({
      next: (orders: any[]) => {
        const fresh = orders?.find((o) => String(o._id) === String(currentId));
        if (!fresh) return;
        // Merge so we don't clobber map-driven fields.
        const prev = this.order();
        this.order.set({ ...prev, ...fresh });
      },
    });
  }

  /** Active step index for timeline; -1 when rejected */
  getStepIndex(status: string | undefined): number {
    if (!status || status === "rejected") return -1;
    if (status === "pending") return 0;
    if (status === "confirmed") return 1;
    if (status === "inprogress") {
      return this.order()?.pickupStatus === "picked" ? 3 : 2;
    }
    if (status === "completed") return 4;
    return 0;
  }

  /** Human-readable label shown in header pill. */
  statusLabel(o: any): string {
    if (!o) return "";
    switch (o.status) {
      case "pending":
        return "Pending";
      case "confirmed":
        return "Confirmed";
      case "inprogress":
        return o.pickupStatus === "picked" ? "On the way" : "Preparing";
      case "completed":
        return "Delivered";
      case "rejected":
        return "Declined";
      default:
        return "Updating";
    }
  }

  /** One-line description of current status used under ETA / status card. */
  statusHint(o: any): string {
    if (!o) return "";
    switch (o.status) {
      case "pending":
        return "Waiting for the restaurant to confirm…";
      case "confirmed":
        return "Accepted. A rider will pick up your order soon.";
      case "inprogress":
        return o.pickupStatus === "picked"
          ? "Rider is bringing your order to you."
          : "Rider is on the way to the restaurant.";
      case "completed":
        return "Delivered. Enjoy your meal!";
      default:
        return "Updating…";
    }
  }

  getRoute(
    origin: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral,
  ): void {
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
            this.routePolylinePath.set(directionsOverviewToPath(result));
            const leg = result.routes[0].legs[0];
            this.eta.set(leg.duration?.text || "");
          } else {
            this.routePolylinePath.set([]);
          }
        });
      },
    );
  }

  getDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const dx = a.lat - b.lat;
    const dy = a.lng - b.lng;
    return Math.sqrt(dx * dx + dy * dy);
  }

  ngOnDestroy(): void {
    this.socket.off("order-updated");
    this.socket.off("location-update");
  }
}
