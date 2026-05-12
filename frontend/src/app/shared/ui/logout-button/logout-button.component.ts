import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService, AppRole } from "../../../services/auth.service";
import { SocketService } from "../../../services/socket.service";
import { ToastService } from "../../services/toast.service";

@Component({
  selector: "app-logout-button",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // On mobile we float the button below the global theme toggle (fixed top:12 right:12, ~40px tall),
  // landing it cleanly under the toggle. On `sm`+ the host returns to the regular flow inside the page header.
  host: {
    class:
      "fixed right-3 top-[3.75rem] z-[80] inline-flex sm:static sm:top-auto sm:right-auto sm:z-auto",
  },
  template: `
    <button
      type="button"
      class="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:bg-slate-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-9 sm:w-auto sm:px-3"
      (click)="logout()"
      [disabled]="busy()"
      aria-label="Log out"
      title="Log out"
    >
      @if (busy()) {
        <span
          class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-slate-100"
          aria-hidden="true"
        ></span>
      } @else {
        <svg
          class="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      }
      <span class="hidden sm:inline">Logout</span>
    </button>
  `,
})
export class LogoutButtonComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly socket = inject(SocketService);

  readonly busy = signal(false);

  logout(): void {
    if (this.busy()) return;
    this.busy.set(true);
    const role = this.auth.getCurrentRole();

    this.auth.logout().subscribe({
      next: () => this.finalize(true, role),
      error: () => this.finalize(false, role),
    });
  }

  private finalize(serverOk: boolean, role: AppRole | null): void {
    try {
      this.auth.clearClientSessionData();
    } catch {
      /* no-op */
    }

    try {
      this.socket.socket?.disconnect();
    } catch {
      /* no-op */
    }

    if (serverOk) {
      this.toast.success("Signed out");
    } else {
      this.toast.success("Signed out locally");
    }

    this.busy.set(false);
    const redirect =
      role === "admin"
        ? ["/admin", "login"]
        : role === "delivery"
          ? ["/rider", "login"]
          : ["/"];
    this.router.navigate(redirect);
  }
}
