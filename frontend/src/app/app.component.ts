import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { ThemeService } from "./shared/services/theme.service";
import { ToastHostComponent } from "./shared/ui/toast-host/toast-host.component";
import { ThemeToggleComponent } from "./shared/ui/theme-toggle/theme-toggle.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, ToastHostComponent, ThemeToggleComponent],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  /** Ensures theme effect runs app-wide */
  private readonly _theme = inject(ThemeService);
}
