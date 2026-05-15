import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { GoogleMapsModule } from "@angular/google-maps";
import { ApiService } from "../../services/api.service";
import { ToastService } from "../../shared/services/toast.service";
import { BrandingService } from "../../shared/services/branding.service";

@Component({
  selector: "app-admin-profile",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GoogleMapsModule],
  templateUrl: "./admin-profile.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProfileComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly branding = inject(BrandingService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly legacy = signal(false);

  restaurantId: string | null = null;
  name = "";
  contactPhone = "";
  email = "";
  address = "";
  formattedAddress = "";
  category = "";
  description = "";
  isOpen = true;

  center = signal<google.maps.LatLngLiteral>({ lat: 22.72, lng: 71.65 });
  marker = signal<google.maps.LatLngLiteral>({ lat: 22.72, lng: 71.65 });

  readonly mapOptions: google.maps.MapOptions = {
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  };

  currentPassword = "";
  newPassword = "";
  logoUrl = "";
  bannerUrl = "";
  logoFile: File | null = null;
  bannerFile: File | null = null;

  ngOnInit(): void {
    this.api.getRestaurantProfile().subscribe({
      next: (r: Record<string, unknown>) => {
        this.legacy.set(Boolean(r["isLegacy"]));
        this.restaurantId = (r["_id"] as string) || null;
        this.name = String(r["name"] || "");
        this.contactPhone = String(r["contactPhone"] || "");
        this.email = String(r["email"] || "");
        this.address = String(r["address"] || "");
        this.formattedAddress = String(r["formattedAddress"] || "");
        this.category = String(r["category"] || "");
        this.description = String(r["description"] || "");
        this.isOpen = r["isOpen"] !== false;
        this.logoUrl = String(r["logoUrl"] || "");
        this.bannerUrl = String(r["bannerUrl"] || "");
        const loc = r["location"] as { lat?: number; lng?: number } | undefined;
        if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
          this.center.set({ lat: loc.lat, lng: loc.lng });
          this.marker.set({ lat: loc.lat, lng: loc.lng });
        }
        this.loading.set(false);
      },
      error: () => {
        this.toast.error("Could not load profile");
        this.loading.set(false);
      },
    });
  }

  onMapClick(e: google.maps.MapMouseEvent): void {
    if (this.legacy()) return;
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    this.marker.set({ lat, lng });
    this.center.set({ lat, lng });
  }

  save(): void {
    if (this.legacy() || !this.restaurantId) {
      this.toast.error("Create a restaurant account to edit this profile.");
      return;
    }
    if (this.saving()) return;
    this.saving.set(true);
    const m = this.marker();
    this.api
      .updateRestaurantProfile({
        name: this.name.trim(),
        contactPhone: this.contactPhone.trim(),
        email: this.email.trim(),
        address: this.address.trim(),
        formattedAddress: this.formattedAddress.trim(),
        category: this.category.trim(),
        description: this.description.trim(),
        isOpen: this.isOpen,
        lat: m.lat,
        lng: m.lng,
      })
      .subscribe({
        next: () => {
          this.toast.success("Profile saved");
          void this.branding.refreshFromApi();
        },
        error: (err) => {
          const msg =
            err.error?.error?.message ?? err.message ?? "Save failed";
          this.toast.error(msg);
        },
        complete: () => this.saving.set(false),
      });
  }

  saveImages(): void {
    if (this.legacy() || !this.restaurantId) return;
    if (!this.logoFile && !this.bannerFile) {
      this.toast.error("Choose a logo or banner");
      return;
    }
    const fd = new FormData();
    if (this.logoFile) fd.append("logo", this.logoFile);
    if (this.bannerFile) fd.append("banner", this.bannerFile);
    this.api.updateRestaurantImages(fd).subscribe({
      next: (r) => {
        const body = r as Record<string, unknown>;
        this.toast.success("Images updated");
        this.logoUrl = String(body["logoUrl"] || this.logoUrl);
        this.bannerUrl = String(body["bannerUrl"] || this.bannerUrl);
        this.logoFile = null;
        this.bannerFile = null;
        void this.branding.refreshFromApi();
      },
      error: (err) => {
        const msg =
          err.error?.error?.message ?? err.message ?? "Upload failed";
        this.toast.error(msg);
      },
    });
  }

  changePassword(): void {
    if (!this.currentPassword || !this.newPassword) {
      this.toast.error("Enter current and new password");
      return;
    }
    this.api.changeAdminPassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.toast.success("Password updated");
        this.currentPassword = "";
        this.newPassword = "";
      },
      error: (err) => {
        const msg =
          err.error?.error?.message ?? err.message ?? "Could not update";
        this.toast.error(msg);
      },
    });
  }

  onLogoPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.logoFile = input.files?.[0] ?? null;
  }

  onBannerPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.bannerFile = input.files?.[0] ?? null;
  }
}
