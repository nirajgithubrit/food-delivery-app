import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewChild,
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
import { CartDeliveryAddressComponent } from "./cart-delivery-address/cart-delivery-address.component";
import { OrderHandoffService } from "../../services/order-handoff.service";

@Component({
  selector: "app-cart",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    UiCardComponent,
    UiEmptyStateComponent,
    CartDeliveryAddressComponent,
  ],
  templateUrl: "./cart.component.html",
  styleUrl: "./cart.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartComponent {
  @ViewChild(CartDeliveryAddressComponent)
  private readonly deliverySection?: CartDeliveryAddressComponent;

  private readonly cart = inject(CartService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly ordersStore = inject(CustomerOrdersStore);
  private readonly orderHandoff = inject(OrderHandoffService);

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

    const geo = this.deliverySection?.getOrderGeoPayload();
    if (!geo) {
      this.toast.error("Choose a delivery address — search, pick a suggestion, or use current location.");
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

    const orderData = {
      items,
      totalAmount: this.total(),
      deliveryAddress: geo.deliveryAddress,
      location: geo.location,
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
          const oid = String(order._id);
          this.orderHandoff.show(oid);
          void this.router.navigate(["/orders", oid], { replaceUrl: true }).then((ok) => {
            if (!ok) {
              this.orderHandoff.dismiss();
            }
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
  }
}
