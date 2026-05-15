import {
  AfterViewInit,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { filter, first, firstValueFrom, map, startWith } from "rxjs";
import { AuthService } from "./services/auth.service";
import { OrderHandoffService } from "./services/order-handoff.service";
import { ThemeService } from "./shared/services/theme.service";
import { NotificationService } from "./shared/services/notification.service";
import { ToastHostComponent } from "./shared/ui/toast-host/toast-host.component";
import { PushNotificationCtaComponent } from "./shared/ui/push-notification-cta/push-notification-cta.component";
import { PwaUpdatePromptComponent } from "./shared/ui/pwa-update-prompt/pwa-update-prompt.component";
import { ThemeToggleComponent } from "./shared/ui/theme-toggle/theme-toggle.component";
import { PwaUpdateService } from "./shared/services/pwa-update.service";
import { BrandingService } from "./shared/services/branding.service";

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
    PwaUpdatePromptComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit {
  /** Ensures theme effect runs app-wide */
  private readonly _theme = inject(ThemeService);
  /** Registers SW update checks in production (Netlify / PWA). */
  private readonly _pwaUpdate = inject(PwaUpdateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly appRef = inject(ApplicationRef);
  readonly orderHandoff = inject(OrderHandoffService);
  private readonly branding = inject(BrandingService);

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (!this.orderHandoff.active()) return;
        const path = (this.router.url.split("?")[0] || "").replace(/\/+$/, "");
        if (/^\/orders\/[^/]+$/.test(path)) {
          window.setTimeout(() => this.orderHandoff.dismiss(), 420);
          return;
        }
        if (!path.startsWith("/orders/")) {
          this.orderHandoff.dismiss();
        }
      });

    if (this.auth.isLoggedIn()) {
      void this.notifications.initForLoggedInUser();
      // Single delayed retry — MessagingService dedupes concurrent inits; avoids triple FCM work on iOS PWA.
      window.setTimeout(() => void this.notifications.initForLoggedInUser(), 3_000);
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
    Promise.all([
      firstValueFrom(this.appRef.isStable.pipe(filter(Boolean), first())),
      this.branding.whenReady(),
    ]).then(() => {
      this.branding.applyBootSplash();
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
