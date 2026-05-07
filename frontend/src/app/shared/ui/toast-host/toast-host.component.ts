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
          class="pointer-events-auto flex items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-lift animate-fade-up backdrop-blur-md"
          [ngClass]="panelClass(t.type)"
        >
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold leading-none"
            [ngClass]="iconClass(t.type)"
            aria-hidden="true"
          >
            {{ icon(t.type) }}
          </span>
          <span class="min-w-0 flex-1 text-sm font-medium mb-0 leading-snug">{{ t.message }}</span>
          <button
            type="button"
            class="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm leading-none opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            (click)="toast.dismiss(t.id)"
            aria-label="Dismiss notification"
          >
            <svg
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
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

  iconClass(type: string): string {
    if (type === "success") {
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200";
    }
    if (type === "error") {
      return "bg-red-100 text-red-700 dark:bg-red-900/70 dark:text-red-200";
    }
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  }

  icon(type: string): string {
    if (type === "success") return "✓";
    if (type === "error") return "!";
    return "ℹ";
  }
}
