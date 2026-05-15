import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";
import { SocketService } from "../../services/socket.service";

const STORAGE_KEY = "gg_branding_v1";
const DEFAULT_NAME = "Gir Gamthi";
const DEFAULT_ICON = "icons/icon-192x192.jpg";

export type BrandingPayload = {
  name: string;
  shortName: string;
  logoUrl: string;
  themeColor: string;
  icon192: string;
  icon512: string;
};

type WindowWithBranding = Window & { __ggBrandingReady?: Promise<unknown> };

@Injectable({ providedIn: "root" })
export class BrandingService {
  private readonly http = inject(HttpClient);
  private readonly socket = inject(SocketService);

  readonly name = signal(DEFAULT_NAME);
  readonly shortName = signal(DEFAULT_NAME);
  readonly logoUrl = signal("");
  readonly themeColor = signal("#f97316");
  readonly icon192 = signal(DEFAULT_ICON);
  readonly icon512 = signal("icons/icon-512x512.jpg");

  private socketUnsub: (() => void) | null = null;
  private readyPromise: Promise<void> | null = null;
  private manifestBlobUrl: string | null = null;

  /** Called from APP_INITIALIZER before first route. */
  load(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.doLoad();
    return this.readyPromise;
  }

  whenReady(): Promise<void> {
    return this.load();
  }

  /** Updates inline boot splash from current branding state. */
  applyBootSplash(): void {
    this.applyBootSplashFrom(this.name(), this.icon192());
  }

  refreshFromApi(): Promise<void> {
    const url = `${environment.apiUrl}/restaurant/branding`;
    return firstValueFrom(this.http.get<BrandingPayload>(url)).then((payload) => {
      if (payload?.name) {
        this.applyPayload(payload, true);
        this.applyBootSplash();
      }
    });
  }

  private doLoad(): Promise<void> {
    this.socketUnsub?.();
    this.socketUnsub = this.socket.subscribeEvent("branding-updated", () => {
      void this.refreshFromApi();
    });
    const cached = this.readCache();
    if (cached) {
      this.applyPayload(cached, false);
      this.applyBootSplash();
    }

    const win = typeof window !== "undefined" ? (window as WindowWithBranding) : null;
    const bootReady = win?.__ggBrandingReady ?? Promise.resolve();

    return bootReady
      .then(() => this.refreshFromApi())
      .catch(() => undefined)
      .then(() => {
        this.applyBootSplash();
      });
  }

  private readCache(): BrandingPayload | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as BrandingPayload;
    } catch {
      return null;
    }
  }

  private writeCache(payload: BrandingPayload): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota */
    }
  }

  private applyPayload(payload: BrandingPayload, persist: boolean): void {
    const name = String(payload.name || DEFAULT_NAME).trim() || DEFAULT_NAME;
    const shortName = String(payload.shortName || name).trim() || name;
    const logoUrl = String(payload.logoUrl || "").trim();
    const themeColor = String(payload.themeColor || "#f97316").trim();
    const icon192 = String(payload.icon192 || DEFAULT_ICON).trim() || DEFAULT_ICON;
    const icon512 =
      String(payload.icon512 || "icons/icon-512x512.jpg").trim() ||
      "icons/icon-512x512.jpg";

    this.name.set(name);
    this.shortName.set(shortName);
    this.logoUrl.set(logoUrl);
    this.themeColor.set(themeColor);
    this.icon192.set(icon192);
    this.icon512.set(icon512);

    if (persist) {
      this.writeCache({
        name,
        shortName,
        logoUrl,
        themeColor,
        icon192,
        icon512,
      });
    }

    this.applyToDocument(name, shortName, icon192, themeColor);
  }

  private applyBootSplashFrom(name: string, icon192: string): void {
    if (typeof document === "undefined") return;
    const splashImg = document.querySelector<HTMLImageElement>(
      "#app-boot-splash .boot-splash-logo",
    );
    if (splashImg && icon192) {
      splashImg.src = icon192;
      splashImg.alt = name;
    }
    const splashTitle = document.querySelector(
      "#app-boot-splash [data-boot-title]",
    );
    if (splashTitle && name) {
      splashTitle.textContent = name;
    }
  }

  private applyToDocument(
    name: string,
    shortName: string,
    icon192: string,
    themeColor: string,
  ): void {
    if (typeof document === "undefined") return;

    document.title = name;

    this.setMeta("theme-color", themeColor);
    this.setMeta("apple-mobile-web-app-title", shortName);

    this.upsertLink("icon", icon192, "image/png");
    this.upsertLink("apple-touch-icon", icon192);

    this.applyManifestLink(name, shortName, icon192, this.icon512(), themeColor);

    this.applyBootSplashFrom(name, icon192);
  }

  /** Same-origin blob manifest — avoids cross-origin `start_url` / `scope` warnings. */
  private applyManifestLink(
    name: string,
    shortName: string,
    icon192: string,
    icon512: string,
    themeColor: string,
  ): void {
    if (typeof window === "undefined") return;

    const base = `${window.location.origin}/`;
    const manifest = {
      name,
      short_name: shortName,
      theme_color: themeColor,
      background_color: "#fafafa",
      display: "standalone",
      start_url: base,
      scope: base,
      icons: [
        {
          src: this.resolvePublicUrl(icon192),
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable any",
        },
        {
          src: this.resolvePublicUrl(icon512),
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable any",
        },
      ],
    };

    if (this.manifestBlobUrl) {
      URL.revokeObjectURL(this.manifestBlobUrl);
    }
    const blob = new Blob([JSON.stringify(manifest)], {
      type: "application/manifest+json",
    });
    this.manifestBlobUrl = URL.createObjectURL(blob);
    this.upsertLink("manifest", this.manifestBlobUrl);
  }

  private resolvePublicUrl(url: string): string {
    const raw = String(url || "").trim();
    if (!raw) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${window.location.origin}/${raw.replace(/^\//, "")}`;
  }

  private setMeta(name: string, content: string): void {
    let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  private upsertLink(rel: string, href: string, type?: string): void {
    let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      document.head.appendChild(el);
    }
    if (type) el.type = type;
    el.href = href;
  }
}
