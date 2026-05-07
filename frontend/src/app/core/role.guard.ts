import { Injectable, inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
} from "@angular/router";
import { Observable, catchError, map, of } from "rxjs";
import { ApiService } from "../services/api.service";
import { ToastService } from "../shared/services/toast.service";

@Injectable({ providedIn: "root" })
export class RoleGuard implements CanActivate {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    const allowed = this.collectRoles(route);

    return this.api.getMe().pipe(
      map((user: { role?: string }) => {
        if (!allowed?.length || (user.role && allowed.includes(user.role))) {
          return true;
        }
        this.toast.info("You do not have access to that area.");
        this.router.navigate(["/"]);
        return false;
      }),
      catchError(() => {
        this.toast.info("Please sign in to continue.");
        this.router.navigate(["/"]);
        return of(false);
      }),
    );
  }

  private collectRoles(route: ActivatedRouteSnapshot): string[] | undefined {
    let current: ActivatedRouteSnapshot | null = route;
    while (current) {
      const roles = current.data["roles"] as string[] | undefined;
      if (roles?.length) {
        return roles;
      }
      current = current.parent;
    }
    return undefined;
  }
}
