import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

/** Require any stored session token before route activation (pair with RoleGuard). */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  if (typeof window === "undefined") {
    return router.createUrlTree(["/"]);
  }
  const has = auth.isLoggedIn();
  if (!has) {
    return router.createUrlTree(["/"]);
  }
  return true;
};
