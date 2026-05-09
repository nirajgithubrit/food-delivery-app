import { Injectable, inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";

/**
 * iOS Safari (and strict mobile WebKit) blocks programmatic audio until the user
 * has interacted with the page. Unlock by playing a near-silent clip on first
 * pointer/key event, then reuse one HTMLAudioElement for later socket-driven plays.
 */
@Injectable({ providedIn: "root" })
export class NotificationSoundService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly soundUrl = "/notify.wav";

  private audio: HTMLAudioElement | null = null;
  private unlockListenersRemoved = false;
  private unlocked = false;
  private ctx: AudioContext | null = null;
  private readonly onGesture = (): void => {
    void this.tryUnlockFromUserGesture();
  };

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.audio = new Audio(this.soundUrl);
    this.audio.preload = "auto";

    const g = this.onGesture;
    window.addEventListener("pointerdown", g, { passive: true });
    window.addEventListener("keydown", g);
    // Touches that don't synthesize pointerdown on very old WebKit
    window.addEventListener("touchend", g, { passive: true });
  }

  private detachUnlockGestures(): void {
    if (this.unlockListenersRemoved) return;
    this.unlockListenersRemoved = true;
    const g = this.onGesture;
    window.removeEventListener("pointerdown", g);
    window.removeEventListener("keydown", g);
    window.removeEventListener("touchend", g);
  }

  private tryUnlockFromUserGesture(): void {
    if (this.unlocked || !this.audio) {
      this.detachUnlockGestures();
      return;
    }

    // Resume/create context in the same user-gesture turn (required on iOS).
    this.ensureAudioContext();

    const a = this.audio;
    const prevVolume = a.volume;
    a.volume = 0.001;

    const restore = (): void => {
      a.pause();
      a.currentTime = 0;
      a.volume = prevVolume || 1;
    };

    void a
      .play()
      .then(() => {
        restore();
        this.unlocked = true;
        this.detachUnlockGestures();
        void this.ensureAudioContext();
      })
      .catch(() => {
        a.volume = prevVolume || 1;
      });
  }

  private ensureAudioContext(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AC) return;
    this.ctx = new AC();
    void this.ctx.resume();
  }

  /** Short tone if the WAV cannot play (still requires prior gesture unlock for reliability). */
  private playToneFallback(): void {
    this.ensureAudioContext();
    const c = this.ctx;
    if (!c || c.state !== "running") {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(100);
      }
      return;
    }
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      gain.gain.value = 0.12;
      osc.type = "sine";
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.14);
    } catch {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(100);
      }
    }
  }

  play(): void {
    if (!isPlatformBrowser(this.platformId) || !this.audio) return;

    const a = this.audio;
    a.currentTime = 0;
    a.volume = 1;

    void a.play().catch(() => {
      this.playToneFallback();
    });
  }
}
