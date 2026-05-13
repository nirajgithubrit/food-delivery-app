import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, switchMap, throwError } from "rxjs";
import { AuthService } from "../services/auth.service";

const SKIP_REFRESH_FOR_URL_PARTS = [
  "/auth/firebase-login",
  "/auth/refresh",
  "/auth/admin",
  "/auth/admin/register",
  "/auth/delivery",
  /** Admin / delivery sessions have no refresh token — avoid refresh storms on 401s. */
  "/notifications/",
];

function shouldSkipRefresh(url: string): boolean {
  return SKIP_REFRESH_FOR_URL_PARTS.some((p) => url.includes(p));
}

export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || shouldSkipRefresh(req.url)) {
        return throwError(() => err);
      }
      return auth.refreshSession().pipe(
        switchMap(() => {
          const token = auth.accessToken();
          return next(
            req.clone({
              setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            }),
          );
        }),
        catchError(() => throwError(() => err)),
      );
    }),
  );
};
