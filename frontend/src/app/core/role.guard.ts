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
        this.router.navigate(this.loginCommandsForRoute(route));
        return false;
      }),
      catchError(() => {
        this.toast.info("Please sign in to continue.");
        this.router.navigate(this.loginCommandsForRoute(route));
        return of(false);
      }),
    );
  }

  /** Primary URL segments from the router state (e.g. admin, orders). */
  private collectPathFromSnapshot(route: ActivatedRouteSnapshot): string[] {
    const parts: string[] = [];
    let s: ActivatedRouteSnapshot | null = route.root.firstChild;
    while (s) {
      for (const seg of s.url) {
        if (seg.path) {
          parts.push(seg.path);
        }
      }
      s = s.firstChild;
    }
    return parts;
  }

  private loginCommandsForRoute(route: ActivatedRouteSnapshot): string[] {
    const parts = this.collectPathFromSnapshot(route);
    const rootSeg = parts[0];
    if (rootSeg === "admin") {
      return ["/admin", "login"];
    }
    if (rootSeg === "delivery") {
      return ["/rider", "login"];
    }
    return ["/"];
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
