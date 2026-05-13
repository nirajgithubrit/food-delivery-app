import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PwaUpdateService } from "../../services/pwa-update.service";

@Component({
  selector: "app-pwa-update-prompt",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./pwa-update-prompt.component.html",
  styleUrl: "./pwa-update-prompt.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaUpdatePromptComponent {
  readonly pwa = inject(PwaUpdateService);
  readonly applying = signal(false);

  async onUpdate(): Promise<void> {
    if (this.applying()) return;
    this.applying.set(true);
    await this.pwa.applyUpdateAndReload();
  }

  onLater(): void {
    this.pwa.dismiss();
  }
}
