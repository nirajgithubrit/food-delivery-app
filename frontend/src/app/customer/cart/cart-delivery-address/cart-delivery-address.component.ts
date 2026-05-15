import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { GoogleMapsModule } from "@angular/google-maps";
import { ApiService } from "../../../services/api.service";
import { ToastService } from "../../../shared/services/toast.service";

export type CheckoutAddressType = "home" | "office" | "other";

/** Snapshot stored on user profile (Home / Office) */
export type SavedDeliverySnapshot = {
  fullAddress: string;
  latitude: number;
  longitude: number;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
};

export type OrderDeliveryAddressPayload = {
  fullAddress: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  addressType: CheckoutAddressType;
};

function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined,
): { city: string; state: string; pincode: string } {
  let city = "";
  let state = "";
  let pincode = "";
  if (!components?.length) return { city, state, pincode };
  for (const c of components) {
    const types = c.types;
    if (!city && (types.includes("locality") || types.includes("sublocality_level_1"))) {
      city = c.long_name;
    }
    if (types.includes("administrative_area_level_1")) {
      state = c.long_name;
    }
    if (types.includes("postal_code")) {
      pincode = c.long_name;
    }
  }
  return { city, state, pincode };
}

@Component({
  selector: "app-cart-delivery-address",
  standalone: true,
  imports: [CommonModule, FormsModule, GoogleMapsModule],
  templateUrl: "./cart-delivery-address.component.html",
  styleUrl: "./cart-delivery-address.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartDeliveryAddressComponent implements AfterViewInit, OnDestroy {
  @ViewChild("searchInput") searchInput?: ElementRef<HTMLInputElement>;

  private readonly zone = inject(NgZone);
  private readonly toast = inject(ToastService);
  private readonly api = inject(ApiService);

  /** Saved slots from profile (updated after each order as Home / Office) */
  readonly savedHome = signal<SavedDeliverySnapshot | null>(null);
  readonly savedOffice = signal<SavedDeliverySnapshot | null>(null);

  private autocomplete?: google.maps.places.Autocomplete;
  private autocompleteListener?: google.maps.MapsEventListener;
  private lastReverseKey = "";

  /** Draggable delivery pin on the preview map */
  readonly deliveryMarkerOptions: google.maps.MarkerOptions = {
    draggable: true,
    cursor: "grab",
  };

  readonly addressType = signal<CheckoutAddressType>("home");
  readonly landmark = signal("");
  readonly fullAddress = signal("");
  readonly latitude = signal<number | null>(null);
  readonly longitude = signal<number | null>(null);
  readonly city = signal("");
  readonly state = signal("");
  readonly pincode = signal("");

  readonly locationBusy = signal(false);
  readonly mapsStatus = signal<"ok" | "unavailable">("ok");
  readonly geocodeHint = signal("");

  readonly mapCenter = signal<google.maps.LatLngLiteral>({ lat: 20.5937, lng: 78.9629 });
  readonly markerPosition = signal<google.maps.LatLngLiteral>({ lat: 20.5937, lng: 78.9629 });
  readonly mapZoom = signal(16);

  readonly mapUiOptions: google.maps.MapOptions = {
    mapTypeId: "roadmap",
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: "greedy",
    styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
  };

  readonly showMapPreview = computed(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    return (
      lat != null &&
      lng != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0)
    );
  });

  readonly isReady = computed(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    const text = this.fullAddress().trim();
    return (
      lat != null &&
      lng != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      text.length >= 5
    );
  });

  ngAfterViewInit(): void {
    if (this.mapsRuntimeOk()) {
      const el = this.searchInput?.nativeElement;
      if (el) {
        try {
          const ac = new google.maps.places.Autocomplete(el, {
            fields: ["geometry", "formatted_address", "address_components"],
          });
          this.autocomplete = ac;
          this.autocompleteListener = ac.addListener("place_changed", () => {
            const place = ac.getPlace();
            this.zone.run(() => this.applyPlaceResult(place));
          });
        } catch {
          this.mapsStatus.set("unavailable");
          this.toast.error("Address search is unavailable right now.");
        }
      }
    } else {
      this.mapsStatus.set("unavailable");
      this.toast.error("Maps could not load. Check your connection and try again.");
    }

    this.loadSavedProfile();
  }

  ngOnDestroy(): void {
    if (this.autocompleteListener) {
      google.maps.event.removeListener(this.autocompleteListener);
      this.autocompleteListener = undefined;
    }
  }

  chipLabel(opt: string): string {
    if (opt === "home" && this.savedHome()) return "Home ✓";
    if (opt === "office" && this.savedOffice()) return "Office ✓";
    return opt;
  }

  setAddressType(t: CheckoutAddressType): void {
    this.addressType.set(t);
    if (t === "other") {
      this.clearAddressForm();
      return;
    }
    const slot = t === "home" ? this.savedHome() : this.savedOffice();
    if (slot) {
      this.applySavedSlot(slot);
      return;
    }
    this.toast.info(
      t === "home"
        ? "No saved home yet. Search below — it saves when you place an order with Home selected."
        : "No saved office yet. Search below — it saves when you place an order with Office selected.",
    );
  }

  useCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.toast.error("This device does not support location.");
      return;
    }
    this.locationBusy.set(true);
    this.geocodeHint.set("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.zone.run(() => this.reverseGeocode(lat, lng));
      },
      (err: GeolocationPositionError) => {
        this.zone.run(() => {
          this.locationBusy.set(false);
          if (err.code === 1) {
            this.toast.error("Location permission denied. Enable it in browser settings or search your address.");
          } else if (err.code === 2) {
            this.toast.error("Could not read your position. Move outdoors or search your address.");
          } else {
            this.toast.error("Could not use your current location. Try searching instead.");
          }
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  }

  /** Combined payload for POST /orders — `location` kept for older APIs. */
  getOrderGeoPayload():
    | { deliveryAddress: OrderDeliveryAddressPayload; location: { lat: number; lng: number } }
    | null {
    if (!this.isReady()) return null;
    const lat = this.latitude() as number;
    const lng = this.longitude() as number;
    const lm = this.landmark().trim();
    const c = this.city().trim();
    const s = this.state().trim();
    const p = this.pincode().trim();
    const deliveryAddress: OrderDeliveryAddressPayload = {
      fullAddress: this.fullAddress().trim(),
      latitude: lat,
      longitude: lng,
      addressType: this.addressType(),
      ...(lm ? { landmark: lm } : {}),
      ...(c ? { city: c } : {}),
      ...(s ? { state: s } : {}),
      ...(p ? { pincode: p } : {}),
    };
    return {
      deliveryAddress,
      location: { lat, lng },
    };
  }

  mapsRuntimeOk(): boolean {
    return typeof google !== "undefined" && !!google.maps?.Geocoder && !!google.maps?.places?.Autocomplete;
  }

  onDeliveryMarkerDragEnd(ev: google.maps.MapMouseEvent): void {
    const ll = ev.latLng;
    if (!ll) return;
    const lat = ll.lat();
    const lng = ll.lng();
    this.zone.run(() => {
      this.latitude.set(lat);
      this.longitude.set(lng);
      this.markerPosition.set({ lat, lng });
      this.mapCenter.set({ lat, lng });
      this.reverseGeocodeAtDroppedPin(lat, lng);
    });
  }

  private applyPlaceResult(place: google.maps.places.PlaceResult): void {
    const loc = place.geometry?.location;
    if (!loc) {
      this.toast.error("Pick a full address from the suggestions list.");
      return;
    }
    const lat = loc.lat();
    const lng = loc.lng();
    const formatted = (place.formatted_address || "").trim();
    if (formatted) {
      this.fullAddress.set(formatted);
      const el = this.searchInput?.nativeElement;
      if (el) el.value = formatted;
    }
    const parts = parseAddressComponents(place.address_components);
    this.city.set(parts.city);
    this.state.set(parts.state);
    this.pincode.set(parts.pincode);
    this.applyCoords(lat, lng);
    this.geocodeHint.set("");
  }

  /**
   * @param fixedPin When set (e.g. after dragging the marker), keep these coordinates and only refresh address text.
   */
  private applyGeocoderResult(
    result: google.maps.GeocoderResult,
    fixedPin?: { lat: number; lng: number } | null,
  ): void {
    const formatted = (result.formatted_address || "").trim();
    if (formatted) {
      this.fullAddress.set(formatted);
      const el = this.searchInput?.nativeElement;
      if (el) el.value = formatted;
    }
    const parts = parseAddressComponents(result.address_components);
    this.city.set(parts.city);
    this.state.set(parts.state);
    this.pincode.set(parts.pincode);

    if (fixedPin) {
      this.applyCoords(fixedPin.lat, fixedPin.lng);
      return;
    }
    const loc = result.geometry?.location;
    if (!loc) return;
    this.applyCoords(loc.lat(), loc.lng());
  }

  /** Reverse geocode after the user drags the map pin — keeps the dropped coordinates. */
  private reverseGeocodeAtDroppedPin(lat: number, lng: number): void {
    if (!this.mapsRuntimeOk()) return;
    this.geocodeHint.set("");
    new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      this.zone.run(() => {
        if (status === "OK" && results?.[0]) {
          this.applyGeocoderResult(results[0], { lat, lng });
          this.geocodeHint.set("Pin moved — address updated. Drag again or pick from search if needed.");
        } else {
          this.geocodeHint.set("No street address here — drag closer to a building or search.");
        }
      });
    });
  }

  private reverseGeocode(lat: number, lng: number): void {
    if (!this.mapsRuntimeOk()) {
      this.locationBusy.set(false);
      this.toast.error("Maps are not ready yet. Wait a moment and try again.");
      return;
    }
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (key === this.lastReverseKey && this.fullAddress().trim().length >= 5) {
      this.applyCoords(lat, lng);
      this.locationBusy.set(false);
      return;
    }

    new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      this.zone.run(() => {
        this.locationBusy.set(false);
        if (status === "OK" && results?.[0]) {
          this.lastReverseKey = key;
          this.applyGeocoderResult(results[0], { lat, lng });
          this.geocodeHint.set("");
        } else {
          this.fullAddress.set(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          this.applyCoords(lat, lng);
          this.geocodeHint.set("Approximate pin saved — refine by searching your street or building.");
          this.toast.error("Could not resolve that pin to a street address. Search to refine.");
        }
      });
    });
  }

  private applyCoords(lat: number, lng: number): void {
    this.latitude.set(lat);
    this.longitude.set(lng);
    const literal = { lat, lng };
    this.markerPosition.set(literal);
    this.mapCenter.set(literal);
    this.mapZoom.set(17);
  }

  private normalizeSavedSlot(raw: unknown): SavedDeliverySnapshot | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const fullAddress = String(r["fullAddress"] ?? "").trim();
    const lat = Number(r["latitude"]);
    const lng = Number(r["longitude"]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || fullAddress.length < 5) return null;
    return {
      fullAddress,
      latitude: lat,
      longitude: lng,
      landmark: String(r["landmark"] ?? "").trim(),
      city: String(r["city"] ?? "").trim(),
      state: String(r["state"] ?? "").trim(),
      pincode: String(r["pincode"] ?? "").trim(),
    };
  }

  private loadSavedProfile(): void {
    this.api.getSavedDeliveryAddresses().subscribe({
      next: (body) => {
        this.zone.run(() => {
          const lastRaw = String(body?.lastCheckoutAddressType ?? "home").toLowerCase();
          const last: CheckoutAddressType = ["home", "office", "other"].includes(lastRaw)
            ? (lastRaw as CheckoutAddressType)
            : "home";
          const raw = body?.savedDeliveryAddresses;
          const home = this.normalizeSavedSlot(raw?.home);
          const office = this.normalizeSavedSlot(raw?.office);
          this.savedHome.set(home);
          this.savedOffice.set(office);
          this.applyDefaultFromSavedProfile(last);
        });
      },
      error: () => {
        this.zone.run(() => {
          this.savedHome.set(null);
          this.savedOffice.set(null);
          this.applyDefaultFromSavedProfile("home");
        });
      },
    });
  }

  /** First load: prefer last-used type, then Home, then Office, else Other + empty. */
  private applyDefaultFromSavedProfile(last: CheckoutAddressType): void {
    const home = this.savedHome();
    const office = this.savedOffice();

    const apply = (t: CheckoutAddressType, slot: SavedDeliverySnapshot | null): boolean => {
      if (!slot) return false;
      this.addressType.set(t);
      this.applySavedSlot(slot);
      return true;
    };

    if (last === "home" && apply("home", home)) return;
    if (last === "office" && apply("office", office)) return;
    if (last === "other") {
      this.addressType.set("other");
      this.clearAddressForm();
      return;
    }
    if (apply("home", home)) return;
    if (apply("office", office)) return;
    this.addressType.set("other");
    this.clearAddressForm();
  }

  private applySavedSlot(slot: SavedDeliverySnapshot): void {
    this.fullAddress.set(slot.fullAddress);
    this.landmark.set(slot.landmark || "");
    this.city.set(slot.city || "");
    this.state.set(slot.state || "");
    this.pincode.set(slot.pincode || "");
    const el = this.searchInput?.nativeElement;
    if (el) el.value = slot.fullAddress;
    this.applyCoords(slot.latitude, slot.longitude);
    this.geocodeHint.set("");
  }

  private clearAddressForm(): void {
    this.fullAddress.set("");
    this.landmark.set("");
    this.city.set("");
    this.state.set("");
    this.pincode.set("");
    this.latitude.set(null);
    this.longitude.set(null);
    this.markerPosition.set({ lat: 20.5937, lng: 78.9629 });
    this.mapCenter.set({ lat: 20.5937, lng: 78.9629 });
    this.mapZoom.set(16);
    const el = this.searchInput?.nativeElement;
    if (el) el.value = "";
    this.geocodeHint.set("");
  }
}
