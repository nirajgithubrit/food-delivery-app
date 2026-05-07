import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "ui-card",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="panelClass()">
      <ng-content />
    </div>
  `,
})
export class UiCardComponent {
  padding = input<"none" | "sm" | "md" | "lg">("md");
  elevated = input(true);

  panelClass(): string {
    const p = this.padding();
    const padMap: Record<"none" | "sm" | "md" | "lg", string> = {
      none: "",
      sm: "p-3",
      md: "p-4 sm:p-5",
      lg: "p-5 sm:p-6",
    };
    const pad = padMap[p];
    const shadow = this.elevated()
      ? "shadow-glass dark:shadow-none border border-slate-200/70 dark:border-slate-700/80"
      : "border border-slate-200/60 dark:border-slate-800";
    return `rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm ${shadow} ${pad}`;
  }
}
