import { effect, Injectable, signal } from "@angular/core";

const STORAGE_KEY = "lb-theme";

@Injectable({ providedIn: "root" })
export class ThemeService {
  /** `true` = dark mode */
  readonly dark = signal(false);

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      this.dark.set(stored === "dark");
    } else {
      this.dark.set(
        typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-color-scheme: dark)")?.matches,
      );
    }

    effect(() => {
      const isDark = this.dark();
      document.documentElement.classList.toggle("dark", isDark);
      localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
    });
  }

  toggle(): void {
    this.dark.update((v) => !v);
  }

  setDark(value: boolean): void {
    this.dark.set(value);
  }
}
