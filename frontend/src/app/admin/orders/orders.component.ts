import {
  ChangeDetectionStrategy,
  Component,
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
export class OrdersComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);
  private readonly toast = inject(ToastService);

  readonly orders = signal<any[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.load();

    this.socket.listen("new-order-admin", () => {
      this.load();
    });

    this.socket.listen("order-updated", (updatedOrder: any) => {
      this.orders.update((list) => {
        const index = list.findIndex(
          (o) => String(o._id) === String(updatedOrder._id),
        );
        if (index > -1) {
          const next = [...list];
          next[index] = updatedOrder;
          return next;
        }
        return [updatedOrder, ...list];
      });
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.getOrders().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : [];
        this.orders.set(list);
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

  ngOnDestroy(): void {
    this.socket.socket.off("new-order-admin");
    this.socket.socket.off("order-updated");
  }

  isDisabled(order: any, action: string): boolean {
    const status = order.status;
    if (status === "completed" || status === "rejected") return true;
    switch (action) {
      case "confirm":
        return status !== "pending";
      case "progress":
        return status !== "confirmed";
      case "done":
        return status !== "inprogress";
      case "reject":
        return status !== "pending";
      default:
        return false;
    }
  }
}
