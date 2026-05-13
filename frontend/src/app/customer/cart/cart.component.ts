import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { finalize } from "rxjs";
import { ApiService } from "../../services/api.service";
import { CartService } from "../../services/cart.service";
import { ToastService } from "../../shared/services/toast.service";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { UiCardComponent } from "../../shared/ui/ui-card/ui-card.component";
import { UiEmptyStateComponent } from "../../shared/ui/ui-empty-state/ui-empty-state.component";
import { CustomerOrdersStore, CustomerOrder } from "../services/customer-orders.store";

@Component({
  selector: "app-cart",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    UiCardComponent,
    UiEmptyStateComponent,
  ],
  templateUrl: "./cart.component.html",
  styleUrl: "./cart.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartComponent {
  private readonly cart = inject(CartService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly ordersStore = inject(CustomerOrdersStore);

  readonly cartItems = toSignal(this.cart.getItems(), {
    initialValue: [] as any[],
  });

  readonly paymentMethod = signal<"cod" | "upi">("cod");

  /** Prevents double taps creating multiple orders while location/API runs. */
  readonly placingOrder = signal(false);

  readonly total = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.price * item.qty, 0),
  );

  setPay(method: "cod" | "upi"): void {
    this.paymentMethod.set(method);
  }

  increase(item: any): void {
    this.cart.add(item);
  }

  decrease(item: any): void {
    this.cart.remove(item);
  }

  placeOrder(): void {
    if (this.placingOrder()) return;

    const items = this.cartItems();
    if (!items.length) return;

    if (!navigator.geolocation) {
      this.toast.error("Location is required to place an order.");
      return;
    }

    const phone = (
      typeof localStorage !== "undefined"
        ? localStorage.getItem("user") || ""
        : ""
    )
      .trim()
      .replace(/\s+/g, "");
    if (phone.length < 10) {
      this.toast.error(
        "Your account needs a valid phone number. Sign in again with your mobile number.",
      );
      return;
    }

    this.placingOrder.set(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const orderData = {
          items,
          totalAmount: this.total(),
          location: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          },
          phone,
          paymentMethod: this.paymentMethod(),
        };

        this.api
          .placeOrder(orderData)
          .pipe(finalize(() => this.placingOrder.set(false)))
          .subscribe({
            next: (res: unknown) => {
              const order = res as CustomerOrder;
              localStorage.setItem("orderId", order._id);
              this.cart.clear();
              this.ordersStore.selectedTrackingOrder.set(null);
              if (order?._id) {
                this.ordersStore.activeOrders.update((list) => {
                  const id = String(order._id);
                  if (list.some((o) => String(o._id) === id)) return list;
                  return [order, ...list];
                });
              }
              this.toast.success("Order placed! Track it live.");
              void this.router.navigate(["/orders", order._id], {
                replaceUrl: true,
              });
            },
            error: (err) => {
              const msg =
                err.error?.error?.message ??
                err.message ??
                "Could not place order";
              this.toast.error(msg);
            },
          });
      },
      () => {
        this.placingOrder.set(false);
        this.toast.error("Allow location access to deliver to your address.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }
}
