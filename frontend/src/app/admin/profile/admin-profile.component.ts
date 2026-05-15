import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  computed,
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
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly legacy = signal(false);

  readonly logoUrl = signal("");
  readonly bannerUrl = signal("");
  /** Busts browser cache on `<img [src]>` after upload. */
  private readonly logoCacheKey = signal(0);
  private readonly bannerCacheKey = signal(0);
  /** Local preview while a new file is chosen (before upload completes). */
  readonly logoPickPreview = signal<string | null>(null);
  readonly bannerPickPreview = signal<string | null>(null);

  readonly logoDisplayUrl = computed(() => {
    const picked = this.logoPickPreview();
    if (picked) return picked;
    return this.withCacheBust(this.logoUrl(), this.logoCacheKey());
  });

  readonly bannerDisplayUrl = computed(() => {
    const picked = this.bannerPickPreview();
    if (picked) return picked;
    return this.withCacheBust(this.bannerUrl(), this.bannerCacheKey());
  });

  readonly hasImagePreview = computed(
    () =>
      !!this.logoDisplayUrl() ||
      !!this.bannerDisplayUrl() ||
      !!this.logoPickPreview() ||
      !!this.bannerPickPreview(),
  );

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
        this.logoUrl.set(String(r["logoUrl"] || ""));
        this.bannerUrl.set(String(r["bannerUrl"] || ""));
        const loc = r["location"] as { lat?: number; lng?: number } | undefined;
        if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
          this.center.set({ lat: loc.lat, lng: loc.lng });
          this.marker.set({ lat: loc.lat, lng: loc.lng });
        }
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error("Could not load profile");
        this.loading.set(false);
      },
    });

    this.destroyRef.onDestroy(() => {
      this.revokePickPreview("logo");
      this.revokePickPreview("banner");
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
        this.applyUploadedImages(r);
        this.logoFile = null;
        this.bannerFile = null;
        this.toast.success("Images updated");
        void this.branding.refreshFromApi();
        this.cdr.markForCheck();
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
    const file = input.files?.[0] ?? null;
    this.logoFile = file;
    this.revokePickPreview("logo");
    this.logoPickPreview.set(file ? URL.createObjectURL(file) : null);
  }

  onBannerPick(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.bannerFile = file;
    this.revokePickPreview("banner");
    this.bannerPickPreview.set(file ? URL.createObjectURL(file) : null);
  }

  private applyUploadedImages(data: unknown): void {
    if (!data || typeof data !== "object") return;
    const body = data as Record<string, unknown>;
    const nextLogo = String(body["logoUrl"] ?? "").trim();
    const nextBanner = String(body["bannerUrl"] ?? "").trim();

    if (nextLogo) {
      this.revokePickPreview("logo");
      this.logoUrl.set(nextLogo);
      this.logoCacheKey.update((k) => k + 1);
    }
    if (nextBanner) {
      this.revokePickPreview("banner");
      this.bannerUrl.set(nextBanner);
      this.bannerCacheKey.update((k) => k + 1);
    }
  }

  private withCacheBust(url: string, key: number): string {
    if (!url) return "";
    if (!key) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${key}`;
  }

  private revokePickPreview(kind: "logo" | "banner"): void {
    if (kind === "logo") {
      const prev = this.logoPickPreview();
      if (prev) URL.revokeObjectURL(prev);
      this.logoPickPreview.set(null);
      return;
    }
    const prev = this.bannerPickPreview();
    if (prev) URL.revokeObjectURL(prev);
    this.bannerPickPreview.set(null);
  }
}
