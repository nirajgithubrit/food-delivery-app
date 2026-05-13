import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "ui-empty-state",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="flex flex-col items-center justify-center text-center py-14 px-6 rounded-3xl border border-dashed border-slate-300/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40"
    >
      <span class="text-4xl mb-3" aria-hidden="true">{{ icon() }}</span>
      <p
        class="font-display text-base font-semibold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-lg"
      >
        {{ title() }}
      </p>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
        {{ description() }}
      </p>
      <div class="mt-6 w-full max-w-xs">
        <ng-content />
      </div>
    </div>
  `,
})
export class UiEmptyStateComponent {
  icon = input("📭");
  title = input("Nothing here yet");
  description = input("Check back soon or try another action.");
}
