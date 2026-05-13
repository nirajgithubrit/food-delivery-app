import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

function roleFromStoredJwt(key: "authToken" | "refreshToken"): string | null {
  if (typeof window === "undefined") return null;
  const t = sessionStorage.getItem(key) || localStorage.getItem(key);
  if (!t) return null;
  try {
    const part = t.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized)) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

/**
 * If a customer session is already present, skip the marketing login page.
 */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const role =
    roleFromStoredJwt("authToken") || roleFromStoredJwt("refreshToken");
  if (role === "customer") {
    return router.createUrlTree(["/customer", "menu"]);
  }
  return true;
};
