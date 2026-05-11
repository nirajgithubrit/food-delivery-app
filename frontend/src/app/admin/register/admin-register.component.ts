import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { GoogleMapsModule } from "@angular/google-maps";
import { ApiService } from "../../services/api.service";
import { ToastService } from "../../shared/services/toast.service";
import { PushNotificationService } from "../../shared/services/push-notification.service";

@Component({
  selector: "app-admin-register",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GoogleMapsModule],
  templateUrl: "./admin-register.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRegisterComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly push = inject(PushNotificationService);

  readonly submitting = signal(false);

  username = "";
  email = "";
  password = "";
  confirmPassword = "";
  restaurantName = "";
  restaurantContact = "";
  restaurantAddress = "";
  category = "";
  description = "";
  formattedAddress = "";

  logoFile: File | null = null;
  bannerFile: File | null = null;

  center = signal<google.maps.LatLngLiteral>({
    lat: 22.721585,
    lng: 71.647064,
  });
  marker = signal<google.maps.LatLngLiteral>({
    lat: 22.721585,
    lng: 71.647064,
  });

  readonly mapOptions: google.maps.MapOptions = {
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  };

  onMapClick(e: google.maps.MapMouseEvent): void {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    this.marker.set({ lat, lng });
    this.center.set({ lat, lng });
  }

  onLogoPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.logoFile = input.files?.[0] ?? null;
  }

  onBannerPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.bannerFile = input.files?.[0] ?? null;
  }

  submit(): void {
    if (this.submitting()) return;

    if (this.password.length < 8) {
      this.toast.error("Password must be at least 8 characters");
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.toast.error("Passwords do not match");
      return;
    }

    const m = this.marker();
    const fd = new FormData();
    fd.append("username", this.username.trim());
    fd.append("email", this.email.trim());
    fd.append("password", this.password);
    fd.append("confirmPassword", this.confirmPassword);
    fd.append("restaurantName", this.restaurantName.trim());
    fd.append("restaurantContact", this.restaurantContact.trim());
    fd.append("restaurantAddress", this.restaurantAddress.trim());
    fd.append("category", this.category.trim());
    fd.append("description", this.description.trim());
    fd.append("formattedAddress", this.formattedAddress.trim());
    fd.append("lat", String(m.lat));
    fd.append("lng", String(m.lng));
    if (this.logoFile) fd.append("logo", this.logoFile);
    if (this.bannerFile) fd.append("banner", this.bannerFile);

    this.submitting.set(true);
    this.api.registerAdmin(fd).subscribe({
      next: (res: { token?: string }) => {
        if (res?.token) sessionStorage.setItem("authToken", res.token);
        void this.push.initForLoggedInUser();
        this.toast.success("Restaurant account created");
        void this.router.navigate(["/admin/orders"]);
      },
      error: (err) => {
        const msg =
          err.error?.error?.message ?? err.message ?? "Registration failed";
        this.toast.error(msg);
      },
      complete: () => this.submitting.set(false),
    });
  }
}
