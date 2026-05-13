import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from "@angular/core";
import { ApiService } from "../../services/api.service";
import { SocketService } from "../../services/socket.service";
import { ToastService } from "../../shared/services/toast.service";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { UiCardComponent } from "../../shared/ui/ui-card/ui-card.component";
import { UiSkeletonComponent } from "../../shared/ui/ui-skeleton/ui-skeleton.component";
import { LogoutButtonComponent } from "../../shared/ui/logout-button/logout-button.component";

@Component({
  selector: "app-orders",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    UiCardComponent,
    UiSkeletonComponent,
    LogoutButtonComponent,
  ],
  templateUrl: "./orders.component.html",
  styleUrl: "./orders.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly orders = signal<any[]>([]);
  readonly loading = signal(true);

  private socketTeardown?: () => void;

  ngOnInit(): void {
    this.load();

    this.socket.onReconnect(() => this.wireSocketListeners());
    this.wireSocketListeners();

    this.destroyRef.onDestroy(() => {
      this.socketTeardown?.();
    });
  }

  private wireSocketListeners(): void {
    this.socketTeardown?.();
    const unsubs: Array<() => void> = [];

    unsubs.push(
      this.socket.subscribeEvent("new-order-admin", () => {
        this.load();
      }),
    );

    unsubs.push(
      this.socket.subscribeEvent("order-updated", (updatedOrder: any) => {
        this.orders.update((list) => {
          const index = list.findIndex(
            (o) => String(o._id) === String(updatedOrder._id),
          );
          if (index > -1) {
            const next = [...list];
            next[index] = { ...list[index], ...updatedOrder };
            return next;
          }
          return [updatedOrder, ...list];
        });
      }),
    );

    this.socketTeardown = () => {
      for (const u of unsubs) u();
    };
  }

  load(): void {
    this.loading.set(true);
    this.api.getOrders().subscribe({
      next: (res: any) => {
        const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        this.orders.set(raw);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("Could not load orders.");
      },
    });
  }

  update(order: any, status: string): void {
    this.api.updateOrder(order._id, status).subscribe({
      next: () => this.toast.success(`Order updated to ${status}`),
      error: (err) => {
        const msg =
          err.error?.error?.message ?? err.message ?? "Update failed";
        this.toast.error(msg);
      },
    });
  }

  assign(order: any): void {
    const deliveryBoyId = prompt("Enter delivery boy user ID");
    if (!deliveryBoyId) return;
    this.api.assignDelivery(order._id, deliveryBoyId).subscribe({
      next: () => this.toast.success("Rider assigned"),
      error: (err) => {
        const msg =
          err.error?.error?.message ?? err.message ?? "Assign failed";
        this.toast.error(msg);
      },
    });
  }

  paymentLabel(order: { paymentMethod?: string } | null | undefined): string {
    const raw = String(order?.paymentMethod ?? "cod").trim().toLowerCase();
    return raw === "upi" ? "UPI" : "Cash on delivery";
  }

  isUPI(order: { paymentMethod?: string } | null | undefined): boolean {
    return String(order?.paymentMethod ?? "cod").trim().toLowerCase() === "upi";
  }

  isDisabled(order: any, action: string): boolean {
    const status = order.status;
    if (status === "delivered" || status === "cancelled" || status === "rejected") return true;
    const riderOk = this.hasRider(order);
    switch (action) {
      case "accept":
        return status !== "pending";
      case "prepare":
        return status !== "accepted" || !riderOk;
      case "ready":
        return status !== "preparing" || !riderOk;
      case "dispatch":
        return (status !== "ready_for_pickup" && status !== "picked_up") || !riderOk;
      case "delivered":
        return status !== "out_for_delivery";
      case "reject":
        return status !== "pending";
      default:
        return false;
    }
  }

  private hasRider(order: { deliveryBoyId?: string | null } | null | undefined): boolean {
    const raw = order?.deliveryBoyId;
    if (raw == null || raw === "") return false;
    const v = String(raw).trim().toLowerCase();
    return v !== "null" && v !== "undefined";
  }
}
