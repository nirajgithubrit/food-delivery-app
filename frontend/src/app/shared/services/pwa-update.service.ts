import { isPlatformBrowser } from "@angular/common";
import {
  Injectable,
  PLATFORM_ID,
  afterNextRender,
  inject,
  signal,
} from "@angular/core";
import { SwUpdate, VersionReadyEvent } from "@angular/service-worker";
import { filter } from "rxjs";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Listens for a new production build via Angular Service Worker (Netlify / static host).
 * Shows a prompt only when a newer app version is ready; "Update" activates it and reloads.
 */
@Injectable({ providedIn: "root" })
export class PwaUpdateService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly swUpdate = inject(SwUpdate);

  /** True when a new version is downloaded and ready to activate. */
  readonly updateReady = signal(false);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      if (!this.swUpdate.isEnabled) return;

      this.swUpdate.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === "VERSION_READY"))
        .subscribe(() => this.updateReady.set(true));

      void this.swUpdate.checkForUpdate();

      const id = window.setInterval(() => {
        void this.swUpdate.checkForUpdate();
      }, CHECK_INTERVAL_MS);

      const onVis = () => {
        if (document.visibilityState === "visible") {
          void this.swUpdate.checkForUpdate();
        }
      };
      document.addEventListener("visibilitychange", onVis);
    });
  }

  dismiss(): void {
    this.updateReady.set(false);
  }

  async applyUpdateAndReload(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      window.location.reload();
      return;
    }
    try {
      await this.swUpdate.activateUpdate();
    } catch {
      /* still reload to pick up assets */
    }
    window.location.reload();
  }
}
