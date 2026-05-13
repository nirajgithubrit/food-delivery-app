import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { isDevMode } from "@angular/core";
import { catchError, throwError } from "rxjs";

/** Optional diagnostics in development; rethrows for component-level handling. */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (isDevMode() && err.status >= 400) {
        console.warn("[HTTP]", req.method, req.url, err.status, err.error);
      }
      return throwError(() => err);
    }),
  );
};
