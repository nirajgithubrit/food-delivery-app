import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";

export type UiButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "accent";
export type UiButtonSize = "sm" | "md" | "lg";

@Component({
  selector: "ui-button",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (link(); as path) {
      <a
        [routerLink]="path"
        [class]="hostClass()"
        class="inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 ease-out focus-ring no-underline active:scale-[0.98]"
      >
        <ng-content />
      </a>
    } @else {
      <button
        [attr.type]="type()"
        [disabled]="disabled()"
        [class]="hostClass()"
        class="inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 ease-out focus-ring disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]"
      >
        <ng-content />
      </button>
    }
  `,
})
export class UiButtonComponent {
  variant = input<UiButtonVariant>("primary");
  size = input<UiButtonSize>("md");
  disabled = input(false);
  type = input<"button" | "submit" | "reset">("button");
  block = input(false);
  /** When set, renders as a router link instead of a button */
  link = input<string | undefined>(undefined);

  hostClass(): string {
    const v = this.variant();
    const s = this.size();
    const base = this.block() ? "w-full " : "";

    const sizes: Record<UiButtonSize, string> = {
      sm: "text-sm px-3 py-2 min-h-[2.25rem]",
      md: "text-sm px-4 py-2.5 min-h-[2.75rem]",
      lg: "text-base px-5 py-3 min-h-[3rem]",
    };

    const variants: Record<UiButtonVariant, string> = {
      primary:
        "bg-gradient-to-r from-brand-500 to-orange-500 text-white shadow-md hover:shadow-lift hover:brightness-[1.03]",
      secondary:
        "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm hover:shadow-md",
      danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
      ghost:
        "bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700",
      accent: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
    };

    return `${base}${sizes[s]} ${variants[v]}`;
  }
}
