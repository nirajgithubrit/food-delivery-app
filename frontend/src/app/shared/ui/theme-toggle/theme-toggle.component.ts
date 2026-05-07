import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ThemeService } from "../../services/theme.service";

@Component({
  selector: "app-theme-toggle",
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="glass-panel focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/70 text-slate-800 shadow-sm transition hover:scale-[1.02] dark:border-slate-700 dark:text-amber-200"
      (click)="theme.toggle()"
      [attr.aria-label]="theme.dark() ? 'Switch to light mode' : 'Switch to dark mode'"
      [attr.aria-pressed]="theme.dark()"
      [attr.title]="theme.dark() ? 'Light mode' : 'Dark mode'"
    >
      @if (theme.dark()) {
        <svg
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      } @else {
        <svg
          class="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          />
        </svg>
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);
}
