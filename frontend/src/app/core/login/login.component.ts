import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { HttpErrorResponse } from "@angular/common/http";
import { finalize } from "rxjs/operators";
import { AuthService } from "../../services/auth.service";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { SocketService } from "../../services/socket.service";
import { ToastService } from "../../shared/services/toast.service";
import { NotificationService } from "../../shared/services/notification.service";
import { FirebasePhoneAuthService } from "../firebase/firebase-phone-auth.service";

export type LoginMode = "customer" | "admin" | "rider";

function mapOtpHttpError(err: unknown): { message: string; cooldownSec: number } {
  const e = err as HttpErrorResponse;
  let msg = "Something went wrong.";
  if (e.error && typeof e.error === "object" && e.error !== null) {
    const body = e.error as { error?: { message?: string }; message?: string };
    msg = body.error?.message || body.message || msg;
  } else if (e.message) {
    msg = e.message;
  }
  if (e.status === 429) {
    return { message: msg, cooldownSec: 120 };
  }
  return { message: msg, cooldownSec: 0 };
}

function mapFirebaseError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  switch (e.code) {
    case "auth/invalid-app-credential":
      return "Invalid app credential: confirm the Web API key in environment matches Firebase Console → Project settings; GCP key allows this origin; Identity Toolkit enabled; turn off App Check enforcement for Auth until the web app registers App Check.";
    case "auth/captcha-check-failed":
      return "reCAPTCHA check failed. Try again, or refresh the page.";
    case "auth/missing-client-identifier":
      return "Missing client identifier. Check Firebase web config (apiKey, appId) and authorized domains.";
    case "auth/quota-exceeded":
      return "SMS quota exceeded for this project. Try again later or use Firebase test numbers.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for OAuth operations. Add it under Authentication → Settings → Authorized domains.";
    case "auth/invalid-phone-number":
      return "Enter a valid mobile number";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/code-expired":
      return "OTP expired. Please request a new code.";
    case "auth/invalid-verification-code":
      return "Invalid OTP. Please check and try again.";
    case "auth/missing-verification-code":
      return "Enter the 6-digit OTP";
    default:
      return e.message || "Unable to complete phone verification";
  }
}

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
  private readonly notifications = inject(NotificationService);
  private readonly firebaseAuth = inject(FirebasePhoneAuthService);

  readonly loginMode = signal<LoginMode>("customer");

  readonly otpSent = signal(false);
  readonly sendingOtp = signal(false);
  readonly verifyingOtp = signal(false);
  readonly otpResendIn = signal(0);
  readonly backendVerifying = signal(false);

  phone = "";
  otp = "";
  name = "";
  email = "";
  password = "";

  private clearResendTimer: (() => void) | null = null;

  phoneDigitsValid(): boolean {
    return /^\d{10}$/.test(this.phone.trim());
  }

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.clearOtpCooldown();
      this.firebaseAuth.dispose();
    });

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

  private startOtpCooldown(seconds: number): void {
    this.clearOtpCooldown();
    this.otpResendIn.set(seconds);
    const id = window.setInterval(() => {
      const next = this.otpResendIn() - 1;
      this.otpResendIn.set(Math.max(0, next));
      if (next <= 0) this.clearOtpCooldown();
    }, 1000);
    this.clearResendTimer = () => clearInterval(id);
  }

  private clearOtpCooldown(): void {
    this.clearResendTimer?.();
    this.clearResendTimer = null;
    this.otpResendIn.set(0);
  }

  sendOTP(): void {
    const trimmed = this.phone.trim();
    if (!/^\d{10}$/.test(trimmed)) {
      this.toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    if (this.sendingOtp()) return;

    this.sendingOtp.set(true);
    this.backendVerifying.set(false);

    void this.firebaseAuth
      .sendOtp(trimmed)
      .then(() => {
        this.otpSent.set(true);
        this.startOtpCooldown(60);
        this.toast.success("OTP sent to your phone");
      })
      .catch((err: unknown) => {
        this.toast.error(mapFirebaseError(err));
      })
      .finally(() => this.sendingOtp.set(false));
  }

  verifyOTP(): void {
    const code = this.otp.trim();
    if (!/^\d{6}$/.test(code)) {
      this.toast.error("Enter the 6-digit OTP you received");
      return;
    }
    if (!this.otpSent()) {
      this.toast.error("Please request an OTP first");
      return;
    }
    if (this.verifyingOtp()) return;

    this.verifyingOtp.set(true);
    this.backendVerifying.set(true);

    void this.firebaseAuth
      .verifyOtp(code)
      .then((firebaseToken) => {
        this.auth
          .firebaseLogin(firebaseToken, this.phone.trim())
          .pipe(
            finalize(() => {
              this.verifyingOtp.set(false);
              this.backendVerifying.set(false);
            }),
          )
          .subscribe({
            next: () => {
              this.socket.reconnect();
              localStorage.setItem("user", this.phone.trim());
              void this.notifications.initForLoggedInUser();
              this.toast.success("Welcome back!");
              this.router.navigate(["/customer/menu"]);
            },
            error: (err: unknown) => {
              const { message } = mapOtpHttpError(err);
              this.toast.error(message);
            },
          });
      })
      .catch((err: unknown) => {
        this.toast.error(mapFirebaseError(err));
        this.verifyingOtp.set(false);
        this.backendVerifying.set(false);
      });
  }

  changeNumber(): void {
    this.resetOtpFlow();
  }

  resendOTP(): void {
    if (this.otpResendIn() > 0) {
      this.toast.error(`Wait ${this.otpResendIn()}s before resending`);
      return;
    }
    if (this.sendingOtp()) return;
    this.otp = "";
    this.backendVerifying.set(false);
    this.sendingOtp.set(true);
    void this.firebaseAuth
      .resendOtp()
      .then(() => {
        this.startOtpCooldown(60);
        this.toast.success("OTP resent");
      })
      .catch((err: unknown) => {
        this.toast.error(mapFirebaseError(err));
      })
      .finally(() => this.sendingOtp.set(false));
  }

  private resetOtpFlow(): void {
    this.clearOtpCooldown();
    this.otpSent.set(false);
    this.otp = "";
    this.backendVerifying.set(false);
    this.firebaseAuth.resetFlow();
  }

  adminLogin(): void {
    this.api.loginAdmin(this.email, this.password).subscribe({
      next: (res: { token?: string }) => {
        if (res?.token) {
          this.auth.setLegacySession(res.token);
        }
        this.socket.reconnect();
        void this.notifications.initForLoggedInUser();
        this.toast.success("Admin signed in");
        this.router.navigate(["/admin/orders"]);
      },
      error: () => this.toast.error("Invalid credentials"),
    });
  }

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
        if (res?.token) {
          this.auth.setLegacySession(res.token);
        }
        this.socket.reconnect();
        void this.notifications.initForLoggedInUser();
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
