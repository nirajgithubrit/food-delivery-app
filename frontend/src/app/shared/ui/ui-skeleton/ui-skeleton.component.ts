import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "ui-skeleton",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      [class]="
        'relative overflow-hidden rounded-xl bg-slate-200/80 dark:bg-slate-800 ' +
        roundedClass()
      "
      [style.width]="width()"
      [style.height]="height()"
      role="status"
      [attr.aria-label]="ariaLabel()"
    >
      <div
        class="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10"
      ></div>
    </div>
  `,
})
export class UiSkeletonComponent {
  width = input<string>("100%");
  height = input<string>("1rem");
  rounded = input<"md" | "lg" | "full">("md");
  ariaLabel = input("Loading");

  roundedClass(): string {
    const m: Record<string, string> = {
      md: "rounded-lg",
      lg: "rounded-xl",
      full: "rounded-full",
    };
    return m[this.rounded()];
  }
}
