import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ApiService } from "../../services/api.service";
import { CartService } from "../../services/cart.service";
import { ToastService } from "../../shared/services/toast.service";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { UiCardComponent } from "../../shared/ui/ui-card/ui-card.component";
import { UiSkeletonComponent } from "../../shared/ui/ui-skeleton/ui-skeleton.component";
import { UiEmptyStateComponent } from "../../shared/ui/ui-empty-state/ui-empty-state.component";
import { LogoutButtonComponent } from "../../shared/ui/logout-button/logout-button.component";
import { catchError, of } from "rxjs";

@Component({
  selector: "app-menu",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    UiCardComponent,
    UiSkeletonComponent,
    UiEmptyStateComponent,
    LogoutButtonComponent,
  ],
  templateUrl: "./menu.component.html",
  styleUrl: "./menu.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuComponent {
  private readonly api = inject(ApiService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly items = signal<any[]>([]);
  readonly searchText = signal("");
  readonly selectedCategory = signal<string>("all");
  readonly categories = ["all", "dosa", "pizza", "burger"] as const;

  private readonly quantitiesMap = signal<Record<string, number>>({});

  private readonly cartItems = toSignal(this.cart.getItems(), {
    initialValue: [] as any[],
  });

  readonly cartCount = computed(() =>
    this.cartItems().reduce((sum, i) => sum + (i.qty ?? 0), 0),
  );
  readonly hasLiveOrder = signal(false);

  readonly filteredItems = computed(() => {
    const q = this.searchText().toLowerCase();
    const cat = this.selectedCategory();
    return this.items().filter((item) => {
      const matchSearch = (item.name ?? "").toLowerCase().includes(q);
      const matchCategory = cat === "all" || item.category === cat;
      return matchSearch && matchCategory;
    });
  });

  constructor() {
    this.api
      .getItems()
      .pipe(
        catchError(() => {
          this.toast.error("Could not load menu. Try again.");
          return of([] as any[]);
        }),
      )
      .subscribe((res: any) => {
        const list = Array.isArray(res) ? res : [];
        this.items.set(list);
        const map: Record<string, number> = {};
        list.forEach((item: any) => {
          map[item._id] = 0;
        });
        this.quantitiesMap.set(map);
        this.loading.set(false);
      });

    this.api
      .getCustomerOrders()
      .pipe(
        catchError(() => of([] as any[])),
      )
      .subscribe((orders: any[]) => {
        const latest = orders?.[0];
        const status = String(latest?.status ?? "").trim().toLowerCase();
        this.hasLiveOrder.set(
          status === "pending" || status === "confirmed" || status === "inprogress",
        );
      });
  }

  qty(id: string): number {
    return this.quantitiesMap()[id] ?? 0;
  }

  applyFilters(): void {
    // signals already drive filteredItems; method kept for template (input/change)
  }

  onSearch(value: string): void {
    this.searchText.set(value);
  }

  onCategory(value: string): void {
    this.selectedCategory.set(value);
  }

  increase(item: any): void {
    const id = item._id;
    this.quantitiesMap.update((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
    this.cart.add(item);
  }

  decrease(item: any): void {
    const id = item._id;
    const current = this.quantitiesMap()[id] ?? 0;
    if (current <= 0) return;
    this.quantitiesMap.update((m) => ({ ...m, [id]: current - 1 }));
    this.cart.remove(item);
  }
}
