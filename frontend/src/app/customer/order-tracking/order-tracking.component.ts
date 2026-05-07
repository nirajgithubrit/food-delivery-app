import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import { ApiService } from "../../services/api.service";
import { SocketService } from "../../services/socket.service";
import { ToastService } from "../../shared/services/toast.service";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { GoogleMapsModule } from "@angular/google-maps";
import { UiCardComponent } from "../../shared/ui/ui-card/ui-card.component";
import { UiSkeletonComponent } from "../../shared/ui/ui-skeleton/ui-skeleton.component";

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

  readonly order = signal<any | null>(null);
  readonly loading = signal(true);
  readonly sheetOpen = signal(true);

  center = signal<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });
  markerPosition = signal<google.maps.LatLngLiteral>({ lat: 0, lng: 0 });
  zoom = 15;

  directionsResults = signal<google.maps.DirectionsResult | undefined>(
    undefined,
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

  ngOnInit(): void {
    this.socket.listen("order-updated", (data: any) => {
      if (String(data._id) !== String(this.order()?._id)) return;

      const statusChanged = this.prevStatus !== data.status;
      const pickupChanged = this.prevPickupStatus !== data.pickupStatus;

      if (data.status === "rejected" && statusChanged) {
        this.toast.error(
          "This order was declined by the restaurant. You have not been charged.",
        );
        this.eta.set("");
        this.directionsResults.set(undefined);
      } else if (statusChanged || pickupChanged) {
        new Audio("notify.wav").play().catch(() => undefined);
      }

      this.prevStatus = data.status;
      this.prevPickupStatus = data.pickupStatus;
      this.order.set(data);
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
            const leg = result.routes[0].legs[0];
            this.eta.set(leg.duration?.text || "");
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

  toggleSheet(): void {
    this.sheetOpen.update((v) => !v);
  }

  ngOnDestroy(): void {
    this.socket.off("order-updated");
    this.socket.off("location-update");
  }
}
