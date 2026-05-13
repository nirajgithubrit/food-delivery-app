import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter, map, startWith } from "rxjs";
import { AuthService } from "../../../services/auth.service";
import { MessagingService } from "../../services/messaging.service";

function isLoginUrl(rawUrl: string): boolean {
  const path = (rawUrl.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (path === "/") return true;
  if (path === "/admin/login" || path.startsWith("/admin/login/")) return true;
  if (path === "/rider/login" || path.startsWith("/rider/login/")) return true;
  return false;
}

@Component({
  selector: "app-push-notification-cta",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="pointer-events-auto fixed bottom-0 left-0 right-0 z-[90] border-t border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-slate-700 dark:bg-slate-950/95 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:rounded-2xl sm:border sm:shadow-lg"
        style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px))"
        role="region"
        aria-label="Push notifications"
      >
        @if (messaging.shouldShowIosInstallHint()) {
          <p class="text-xs font-medium leading-relaxed text-slate-700 dark:text-slate-200">
            <span class="font-semibold text-slate-900 dark:text-white">iPhone:</span>
            install the app first — Safari
            <span class="whitespace-nowrap font-mono text-[11px]">Share → Add to Home Screen</span>
            , open the home icon, sign in, then tap
            <span class="font-semibold">Enable notifications</span>.
          </p>
        } @else if (messaging.shouldShowEnablePushButton()) {
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-xs text-slate-600 dark:text-slate-300">
              Turn on alerts for orders and delivery updates.
            </p>
            <button
              type="button"
              class="focus-ring shrink-0 rounded-xl bg-gradient-to-r from-brand-500 to-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
              [disabled]="busy()"
              (click)="enable()"
            >
              @if (busy()) {
                <span>Please wait…</span>
              } @else {
                <span>Enable notifications</span>
              }
            </button>
          </div>
        }
        @if (messaging.permissionState() === "denied") {
          <p class="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Notifications are blocked. On iPhone:
            <span class="font-medium">Settings → Notifications</span>
            for this app (or Safari) and allow alerts.
          </p>
        }
      </div>
    }
  `,
})
export class PushNotificationCtaComponent {
  readonly messaging = inject(MessagingService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly routerUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly busy = signal(false);

  readonly visible = computed(() => {
    if (!this.auth.isLoggedIn()) return false;
    if (isLoginUrl(this.routerUrl())) return false;
    const denied = this.messaging.permissionState() === "denied";
    const hint = this.messaging.shouldShowIosInstallHint();
    const enable = this.messaging.shouldShowEnablePushButton();
    return hint || enable || denied;
  });

  async enable(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.messaging.requestEnablePush();
    } finally {
      this.busy.set(false);
    }
  }
}
