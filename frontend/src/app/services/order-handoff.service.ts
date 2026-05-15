import { Injectable, signal } from "@angular/core";

/**
 * Full-screen “taking you to tracking” overlay between cart checkout and the
 * order-tracking route (covers lazy-load + guard latency so the UI never flashes menu/cart).
 */
@Injectable({ providedIn: "root" })
export class OrderHandoffService {
  readonly active = signal<{ orderId: string } | null>(null);

  show(orderId: string): void {
    const id = String(orderId || "").trim();
    if (!id) return;
    this.active.set({ orderId: id });
  }

  dismiss(): void {
    this.active.set(null);
  }
}
