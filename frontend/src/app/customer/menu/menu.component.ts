import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { toSignal } from "@angular/core/rxjs-interop";
import { ApiService } from "../../services/api.service";
import { CartService } from "../../services/cart.service";
import { SocketService } from "../../services/socket.service";
import { ToastService } from "../../shared/services/toast.service";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { UiCardComponent } from "../../shared/ui/ui-card/ui-card.component";
import { UiSkeletonComponent } from "../../shared/ui/ui-skeleton/ui-skeleton.component";
import { UiEmptyStateComponent } from "../../shared/ui/ui-empty-state/ui-empty-state.component";
import { LogoutButtonComponent } from "../../shared/ui/logout-button/logout-button.component";
import { CustomerOrdersStore } from "../services/customer-orders.store";
import { BrandingService } from "../../shared/services/branding.service";
import { catchError, forkJoin, of } from "rxjs";

type MenuUpdatedEvent = {
  scope?: "items" | "categories" | "all";
  action?: string;
  at?: number;
};

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
  readonly branding = inject(BrandingService);
  private readonly api = inject(ApiService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly ordersStore = inject(CustomerOrdersStore);
  private readonly socket = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  /** Background refresh when menu-updated socket fires */
  readonly menuRefreshing = signal(false);
  readonly items = signal<any[]>([]);
  readonly searchText = signal("");
  readonly selectedCategory = signal<string>("all");
  readonly categories = signal<string[]>(["all"]);

  private readonly quantitiesMap = signal<Record<string, number>>({});
  private socketTeardown?: () => void;

  private readonly cartItems = toSignal(this.cart.getItems(), {
    initialValue: [] as any[],
  });

  readonly cartCount = computed(() =>
    this.cartItems().reduce((sum, i) => sum + (i.qty ?? 0), 0),
  );

  readonly hasLiveOrders = computed(() => this.ordersStore.hasActiveOrders());

  readonly filteredItems = computed(() => {
    const q = this.searchText().toLowerCase();
    const cat = this.selectedCategory();
    return this.items().filter((item) => {
      const matchSearch = (item.name ?? "").toLowerCase().includes(q);
      const matchCategory = cat === "all" || item.category === cat;
      const available = item.isAvailable !== false;
      return matchSearch && matchCategory && available;
    });
  });

  constructor() {
    this.ordersStore.loadActiveOrders();
    this.loadMenu({ initial: true });
    this.wireMenuSocket();

    this.destroyRef.onDestroy(() => {
      this.socketTeardown?.();
    });
  }

  private wireMenuSocket(): void {
    this.socketTeardown?.();
    const unsubs: Array<() => void> = [];

    const joinMenu = () => this.socket.emit("join-menu");

    if (this.socket.connected()) {
      joinMenu();
    }

    unsubs.push(
      this.socket.subscribeEvent("connect", () => {
        joinMenu();
      }),
    );

    unsubs.push(
      this.socket.subscribeEvent<MenuUpdatedEvent>("menu-updated", () => {
        this.loadMenu({ silent: true, notify: true });
      }),
    );

    this.socket.onReconnect(() => {
      joinMenu();
    });

    this.socketTeardown = () => {
      for (const u of unsubs) u();
    };
  }

  /** Refetch items + categories from API (initial load or live socket update). */
  loadMenu(options?: { initial?: boolean; silent?: boolean; notify?: boolean }): void {
    const initial = options?.initial === true;
    const silent = options?.silent === true;

    if (initial) {
      this.loading.set(true);
    } else if (silent) {
      this.menuRefreshing.set(true);
    }

    forkJoin({
      items: this.api.getItems().pipe(
        catchError(() => {
          if (!silent) this.toast.error("Could not load menu. Try again.");
          return of([] as unknown[]);
        }),
      ),
      categories: this.api.getCategories().pipe(catchError(() => of([] as unknown[]))),
    }).subscribe({
      next: ({ items: itemsRes, categories: catRes }) => {
        const list = Array.isArray(itemsRes) ? itemsRes : [];
        this.applyItemsList(list);

        const catList = Array.isArray(catRes) ? catRes : [];
        const dynamic = catList
          .map((c: { slug?: string }) => String(c?.slug || "").trim())
          .filter(Boolean);
        this.categories.set(["all", ...dynamic]);

        const selected = this.selectedCategory();
        if (selected !== "all" && !dynamic.includes(selected)) {
          this.selectedCategory.set("all");
        }

        this.loading.set(false);
        this.menuRefreshing.set(false);

        if (options?.notify) {
          this.toast.info("Menu updated with latest dishes.");
        }
      },
      error: () => {
        this.loading.set(false);
        this.menuRefreshing.set(false);
      },
    });
  }

  private applyItemsList(list: any[]): void {
    this.items.set(list);
    const cartLines = this.cartItems();
    const map: Record<string, number> = {};
    for (const item of list) {
      const id = String(item._id);
      const inCart = cartLines.find((c) => String(c._id) === id);
      map[id] = inCart?.qty ?? 0;
    }
    this.quantitiesMap.set(map);
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
