import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { SocketService } from "../../services/socket.service";
import { ToastService } from "../../shared/services/toast.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);
  private readonly toast = inject(ToastService);

  readonly role = signal<"customer" | "admin" | "delivery">("customer");

  phone = "";
  otp = "";
  email = "";
  password = "";
  confirmationResult: unknown;

  setRole(r: "customer" | "admin" | "delivery"): void {
    this.role.set(r);
  }

  sendOTP(): void {
    const verifier = this.auth.setupRecaptcha("recaptcha");
    this.auth
      .sendOTP("+91" + this.phone, verifier)
      .then((res) => {
        this.confirmationResult = res;
        this.toast.success("OTP sent to your phone");
      })
      .catch(() => this.toast.error("Could not send OTP. Try again."));
  }

  verifyOTP(): void {
    const cr = this.confirmationResult as { confirm: (c: string) => Promise<unknown> };
    cr
      .confirm(this.otp)
      .then(() => {
        this.api.loginCustomer(this.phone).subscribe({
          next: (res: { token?: string }) => {
            if (res?.token) sessionStorage.setItem("authToken", res.token);
            this.socket.reconnect();
            localStorage.setItem("user", this.phone);
            this.toast.success("Welcome back!");
            this.router.navigate(["/customer/menu"]);
          },
          error: (err) => {
            const msg =
              err.error?.error?.message ?? err.message ?? "Login failed";
            this.toast.error(msg);
          },
        });
      })
      .catch(() => this.toast.error("Invalid OTP"));
  }

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

  deliveryLogin(): void {
    this.api
      .loginDelivery(this.phone)
      .subscribe({
        next: (res: { token?: string; user?: { _id: string } }) => {
          if (res?.token) sessionStorage.setItem("authToken", res.token);
          this.socket.reconnect();
          if (res.user?._id) {
            localStorage.setItem("deliveryUser", res.user._id);
          }
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
