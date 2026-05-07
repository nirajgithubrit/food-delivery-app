import { Injectable, signal } from "@angular/core";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: "root" })
export class ToastService {
  private seq = 0;
  readonly items = signal<ToastItem[]>([]);

  show(message: string, type: ToastType = "info", durationMs = 4200): void {
    const id = ++this.seq;
    this.items.update((list) => [...list, { id, message, type }]);
    window.setTimeout(() => this.dismiss(id), durationMs);
  }

  success(message: string): void {
    this.show(message, "success");
  }

  error(message: string): void {
    this.show(message, "error", 6500);
  }

  info(message: string): void {
    this.show(message, "info");
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}
