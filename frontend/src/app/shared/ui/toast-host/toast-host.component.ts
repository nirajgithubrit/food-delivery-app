import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ToastService } from "../../services/toast.service";

@Component({
  selector: "app-toast-host",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed bottom-4 left-1/2 z-[100] flex w-[min(100%,24rem)] -translate-x-1/2 flex-col gap-2 px-3 pointer-events-none"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      @for (t of toast.items(); track t.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lift animate-fade-up backdrop-blur-md"
          [ngClass]="panelClass(t.type)"
        >
          <span class="mt-0.5 text-lg" aria-hidden="true">{{ icon(t.type) }}</span>
          <p class="flex-1 text-sm font-medium leading-snug">{{ t.message }}</p>
          <button
            type="button"
            class="text-xs font-semibold opacity-70 hover:opacity-100 focus-ring rounded-lg px-1"
            (click)="toast.dismiss(t.id)"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  readonly toast = inject(ToastService);

  panelClass(type: string): string {
    if (type === "success") {
      return "border-emerald-200/80 bg-emerald-50/95 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100";
    }
    if (type === "error") {
      return "border-red-200/80 bg-red-50/95 text-red-900 dark:border-red-900 dark:bg-red-950/90 dark:text-red-100";
    }
    return "border-slate-200/80 bg-white/95 text-slate-900 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100";
  }

  icon(type: string): string {
    if (type === "success") return "✓";
    if (type === "error") return "!";
    return "ℹ";
  }
}
