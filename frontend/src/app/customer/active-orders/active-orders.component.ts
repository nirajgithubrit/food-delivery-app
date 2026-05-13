import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { CustomerOrdersStore } from "../services/customer-orders.store";

@Component({
  selector: "app-active-orders",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./active-orders.component.html",
  styleUrl: "./active-orders.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveOrdersComponent implements OnInit {
  readonly store = inject(CustomerOrdersStore);

  ngOnInit(): void {
    this.store.loadActiveOrders();
  }

  statusClass(status: string): string {
    const s = String(status || "").toLowerCase();
    if (["delivered"].includes(s)) return "bg-emerald-100 text-emerald-800";
    if (["cancelled", "rejected"].includes(s)) return "bg-rose-100 text-rose-700";
    if (["out_for_delivery", "picked_up"].includes(s)) return "bg-sky-100 text-sky-800";
    if (["ready_for_pickup", "preparing"].includes(s)) return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  }
}

