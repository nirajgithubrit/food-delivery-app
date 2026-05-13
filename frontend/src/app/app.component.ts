import {
  AfterViewInit,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter, first, map, startWith } from "rxjs";
import { AuthService } from "./services/auth.service";
import { ThemeService } from "./shared/services/theme.service";
import { NotificationService } from "./shared/services/notification.service";
import { ToastHostComponent } from "./shared/ui/toast-host/toast-host.component";
import { PushNotificationCtaComponent } from "./shared/ui/push-notification-cta/push-notification-cta.component";
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
  imports: [
    RouterOutlet,
    ToastHostComponent,
    ThemeToggleComponent,
    PushNotificationCtaComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit {
  /** Ensures theme effect runs app-wide */
  private readonly _theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly appRef = inject(ApplicationRef);

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      void this.notifications.initForLoggedInUser();
    }
  }

  /**
   * First load in this browser tab: show the inline boot splash until Angular is stable
   * (covers slow CDN / cold Render API without flashing a blank shell). Hidden for the
   * rest of the session via sessionStorage.
   */
  ngAfterViewInit(): void {
    if (typeof sessionStorage === "undefined") return;
    const el = document.getElementById("app-boot-splash");
    if (!el) return;
    if (sessionStorage.getItem("gg_boot_splash_done")) {
      el.remove();
      return;
    }
    const done = () => {
      sessionStorage.setItem("gg_boot_splash_done", "1");
      el.classList.add("boot-splash--hide");
      window.setTimeout(() => el.remove(), 380);
    };
    const maxWait = window.setTimeout(done, 12_000);
    this.appRef.isStable
      .pipe(filter(Boolean), first())
      .subscribe(() => {
        window.clearTimeout(maxWait);
        done();
      });
  }

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
