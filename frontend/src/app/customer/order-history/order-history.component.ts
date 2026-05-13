import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { RouterLink } from "@angular/router";
import { CustomerOrdersStore } from "../services/customer-orders.store";

@Component({
  selector: "app-order-history",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./order-history.component.html",
  styleUrl: "./order-history.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderHistoryComponent implements OnInit {
  readonly store = inject(CustomerOrdersStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.store.loadOrderHistory();
  }

  reorder(): void {
    this.router.navigateByUrl("/customer/menu");
  }
}

