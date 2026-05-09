import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter, map, startWith } from "rxjs";
import { ThemeService } from "./shared/services/theme.service";
import { ToastHostComponent } from "./shared/ui/toast-host/toast-host.component";
import { ThemeToggleComponent } from "./shared/ui/theme-toggle/theme-toggle.component";

function isLoginUrl(rawUrl: string): boolean {
  const path = (rawUrl.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (path === "/") return true;
  if (path === "/admin/login" || path.startsWith("/admin/login/")) return true;
  if (path === "/rider/login" || path.startsWith("/rider/login/")) return true;
  return false;
}

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
  private readonly router = inject(Router);

  /** Login routes: mobile theme toggle moves to bottom-right (see global styles). */
  readonly isLoginRoute = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => isLoginUrl(this.router.url)),
      startWith(isLoginUrl(this.router.url)),
    ),
    { initialValue: isLoginUrl(this.router.url) },
  );
}
