import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

/** Require any stored session token before route activation (pair with RoleGuard). */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (typeof sessionStorage === "undefined") {
    return router.createUrlTree(["/"]);
  }
  const has =
    sessionStorage.getItem("authToken") || sessionStorage.getItem("refreshToken");
  if (!has) {
    return router.createUrlTree(["/"]);
  }
  return true;
};
