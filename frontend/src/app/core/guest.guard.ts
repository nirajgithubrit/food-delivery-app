import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

function roleFromJwtSession(key: "authToken" | "refreshToken"): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const t = sessionStorage.getItem(key);
  if (!t) return null;
  try {
    const part = t.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part)) as { role?: string };
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
    roleFromJwtSession("authToken") || roleFromJwtSession("refreshToken");
  if (role === "customer") {
    return router.createUrlTree(["/customer", "menu"]);
  }
  return true;
};
