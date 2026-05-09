import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AuthService } from "../../services/auth.service";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { SocketService } from "../../services/socket.service";
import { ToastService } from "../../shared/services/toast.service";

export type LoginMode = "customer" | "admin" | "rider";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);
  private readonly toast = inject(ToastService);

  readonly loginMode = signal<LoginMode>("customer");

  /** Customer OTP step state. */
  readonly otpSent = signal(false);
  readonly sendingOtp = signal(false);
  readonly verifyingOtp = signal(false);

  phone = "";
  otp = "";
  name = "";
  email = "";
  password = "";

  private confirmationResult: { confirm: (c: string) => Promise<unknown> } | null =
    null;
  private recaptchaVerifier: { clear: () => void } | null = null;

  /** Show reCAPTCHA block only after a valid 10-digit number (compact mobile flow). */
  phoneReadyForCaptcha(): boolean {
    return /^\d{10}$/.test(this.phone.trim());
  }

  /** Clear widget if user edits number away from 10 digits. */
  onCustomerPhoneChange(): void {
    if (!this.phoneReadyForCaptcha()) {
      this.clearRecaptcha();
    }
  }

  ngOnInit(): void {
    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        const mode = data["loginMode"] as LoginMode | undefined;
        this.loginMode.set(mode ?? "customer");
        this.resetOtpFlow();
        this.phone = "";
        this.name = "";
        this.email = "";
        this.password = "";
      });
  }

  // ---------- Customer OTP flow ----------

  sendOTP(): void {
    const trimmed = this.phone.trim();
    if (!/^\d{10}$/.test(trimmed)) {
      this.toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    if (this.sendingOtp()) return;

    this.clearRecaptcha();

    this.sendingOtp.set(true);
    const verifier = this.auth.setupRecaptcha("recaptcha");
    this.recaptchaVerifier = verifier as unknown as { clear: () => void };

    this.auth
      .sendOTP("+91" + trimmed, verifier)
      .then((res) => {
        this.confirmationResult = res as {
          confirm: (c: string) => Promise<unknown>;
        };
        this.otpSent.set(true);
        this.toast.success("OTP sent to your phone");
      })
      .catch(() => this.toast.error("Could not send OTP. Try again."))
      .finally(() => this.sendingOtp.set(false));
  }

  verifyOTP(): void {
    const code = this.otp.trim();
    if (!/^\d{4,6}$/.test(code)) {
      this.toast.error("Enter the OTP you received");
      return;
    }
    if (!this.confirmationResult) {
      this.toast.error("Please request a new OTP");
      return;
    }
    if (this.verifyingOtp()) return;

    this.verifyingOtp.set(true);
    this.confirmationResult
      .confirm(code)
      .then(() => {
        this.api.loginCustomer(this.phone.trim()).subscribe({
          next: (res: { token?: string }) => {
            if (res?.token) sessionStorage.setItem("authToken", res.token);
            this.socket.reconnect();
            localStorage.setItem("user", this.phone.trim());
            this.toast.success("Welcome back!");
            this.router.navigate(["/customer/menu"]);
          },
          error: (err) => {
            const msg =
              err.error?.error?.message ?? err.message ?? "Login failed";
            this.toast.error(msg);
          },
          complete: () => this.verifyingOtp.set(false),
        });
      })
      .catch(() => {
        this.toast.error("Invalid OTP");
        this.verifyingOtp.set(false);
      });
  }

  changeNumber(): void {
    this.resetOtpFlow();
  }

  resendOTP(): void {
    this.resetOtpFlow();
    this.sendOTP();
  }

  private resetOtpFlow(): void {
    this.otpSent.set(false);
    this.confirmationResult = null;
    this.otp = "";
    this.clearRecaptcha();
  }

  private clearRecaptcha(): void {
    try {
      this.recaptchaVerifier?.clear?.();
    } catch {
      /* no-op */
    }
    this.recaptchaVerifier = null;
    const container = document.getElementById("recaptcha");
    if (container) container.innerHTML = "";
  }

  // ---------- Admin ----------

  adminLogin(): void {
    this.api.loginAdmin(this.email, this.password).subscribe({
      next: (res: { token?: string }) => {
        if (res?.token) sessionStorage.setItem("authToken", res.token);
        this.socket.reconnect();
        this.toast.success("Admin signed in");
        this.router.navigate(["/admin/orders"]);
      },
      error: () => this.toast.error("Invalid credentials"),
    });
  }

  // ---------- Rider ----------

  deliveryLogin(): void {
    const name = this.name.trim();
    const phone = this.phone.trim();

    if (!name) {
      this.toast.error("Please enter your name");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      this.toast.error("Enter a valid 10-digit phone number");
      return;
    }

    this.api.loginDelivery(phone, name).subscribe({
      next: (res: { token?: string; user?: { _id: string; name?: string } }) => {
        if (res?.token) sessionStorage.setItem("authToken", res.token);
        this.socket.reconnect();
        if (res.user?._id) {
          localStorage.setItem("deliveryUser", res.user._id);
        }
        localStorage.setItem("deliveryName", res.user?.name || name);
        this.toast.success("Rider online");
        this.router.navigate(["/delivery/dashboard"]);
      },
      error: (err) => {
        const msg =
          err.error?.error?.message ?? err.message ?? "Login failed";
        this.toast.error(msg);
      },
    });
  }
}
