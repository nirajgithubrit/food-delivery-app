import { Injectable, computed, inject, signal } from "@angular/core";
import { ApiService } from "../../services/api.service";
import { SocketService } from "../../services/socket.service";

export type CustomerOrder = {
  _id: string;
  status: string;
  totalAmount: number;
  pickupStatus?: string;
  phone?: string;
  items?: Array<{ _id?: string; name?: string; qty?: number }>;
  createdAt?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  restaurantName?: string;
  restaurantPhone?: string;
  deliveryPin?: string;
  deliveryBoyId?: string | null;
  deliveryBoy?: { name?: string; phone?: string } | null;
  deliveryLocation?: { lat: number; lng: number };
  location?: { lat: number; lng: number };
  restaurantLocation?: { lat: number; lng: number };
};

const TERMINAL = new Set(["delivered", "cancelled", "rejected"]);

function isTerminalStatus(status: string | undefined): boolean {
  return TERMINAL.has(String(status ?? "").toLowerCase());
}

function isActiveStatus(status: string | undefined): boolean {
  return !isTerminalStatus(status);
}

@Injectable({ providedIn: "root" })
export class CustomerOrdersStore {
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);

  private socketTeardown?: () => void;

  readonly activeOrders = signal<CustomerOrder[]>([]);
  readonly orderHistory = signal<CustomerOrder[]>([]);
  readonly selectedTrackingOrder = signal<CustomerOrder | null>(null);
  readonly loadingActive = signal(false);
  readonly loadingHistory = signal(false);
  readonly loadingTracking = signal(false);
  readonly error = signal<string>("");

  readonly hasActiveOrders = computed(() => this.activeOrders().length > 0);

  constructor() {
    this.socket.onReconnect(() => this.rewireSocketListeners());
    this.rewireSocketListeners();
  }

  private rewireSocketListeners(): void {
    this.socketTeardown?.();
    const unsubs: Array<() => void> = [];

    unsubs.push(
      this.socket.subscribeEvent<CustomerOrder>("order-updated", (order) => {
        if (!order?._id) return;
        this.applyOrderUpdated(order);
      }),
    );

    unsubs.push(
      this.socket.subscribeEvent<CustomerOrder & { deliveryLocation?: { lat: number; lng: number } }>(
        "location-update",
        (ord) => {
          if (!ord?._id || !ord.deliveryLocation) return;
          this.patchDeliveryLocation(String(ord._id), ord.deliveryLocation, ord.status);
        },
      ),
    );

    this.socketTeardown = () => {
      for (const u of unsubs) u();
    };
  }

  joinOrderRoom(orderId: string): void {
    this.socket.emit("join-order", orderId);
  }

  loadActiveOrders(): void {
    this.loadingActive.set(true);
    this.error.set("");
    this.api.getCustomerActiveOrders().subscribe({
      next: (orders: unknown) => {
        this.activeOrders.set((Array.isArray(orders) ? orders : []) as CustomerOrder[]);
        this.loadingActive.set(false);
      },
      error: (err) => {
        this.loadingActive.set(false);
        this.error.set(err?.error?.error?.message ?? "Could not load active orders");
      },
    });
  }

  loadOrderHistory(): void {
    this.loadingHistory.set(true);
    this.error.set("");
    this.api.getCustomerOrderHistory().subscribe({
      next: (orders: unknown) => {
        this.orderHistory.set((Array.isArray(orders) ? orders : []) as CustomerOrder[]);
        this.loadingHistory.set(false);
      },
      error: (err) => {
        this.loadingHistory.set(false);
        this.error.set(err?.error?.error?.message ?? "Could not load order history");
      },
    });
  }

  loadOrderById(orderId: string): void {
    this.loadingTracking.set(true);
    this.error.set("");
    this.api.getCustomerOrderById(orderId).subscribe({
      next: (order: unknown) => {
        this.selectedTrackingOrder.set((order || null) as CustomerOrder | null);
        this.joinOrderRoom(orderId);
        this.loadingTracking.set(false);
      },
      error: (err) => {
        this.loadingTracking.set(false);
        this.error.set(err?.error?.error?.message ?? "Could not load order");
      },
    });
  }

  /** Merge fields into the tracked order (e.g. after enrichment fetch). */
  patchSelectedOrder(patch: Partial<CustomerOrder>): void {
    this.selectedTrackingOrder.update((o) => {
      if (!o) return o;
      if (patch._id != null && String(patch._id) !== String(o._id)) return o;
      return { ...o, ...patch };
    });
  }

  private applyOrderUpdated(order: CustomerOrder): void {
    const id = String(order._id);
    const active = isActiveStatus(order.status);

    this.activeOrders.update((list) => {
      const ix = list.findIndex((o) => String(o._id) === id);
      let next = [...list];
      if (ix >= 0) {
        next[ix] = { ...next[ix], ...order };
      } else if (active) {
        next = [{ ...order }, ...list];
      }
      if (!active) {
        next = next.filter((o) => String(o._id) !== id);
      }
      return next;
    });

    this.orderHistory.update((list) => {
      if (active) {
        return list.filter((o) => String(o._id) !== id);
      }
      const ix = list.findIndex((o) => String(o._id) === id);
      if (ix >= 0) {
        const next = [...list];
        next[ix] = { ...next[ix], ...order };
        return next;
      }
      return [{ ...order }, ...list];
    });

    if (String(this.selectedTrackingOrder()?._id) === id) {
      this.selectedTrackingOrder.update((o) => (o ? { ...o, ...order } : null));
    }
  }

  private patchDeliveryLocation(
    orderId: string,
    deliveryLocation: { lat: number; lng: number },
    status?: string,
  ): void {
    const patch: Partial<CustomerOrder> = {
      deliveryLocation: { ...deliveryLocation },
      ...(status != null ? { status: String(status) } : {}),
    };

    this.activeOrders.update((list) => {
      const ix = list.findIndex((o) => String(o._id) === orderId);
      if (ix < 0) return list;
      const next = [...list];
      next[ix] = { ...next[ix], ...patch };
      return next;
    });

    if (String(this.selectedTrackingOrder()?._id) === orderId) {
      this.selectedTrackingOrder.update((o) => (o ? { ...o, ...patch } : null));
    }
  }
}
