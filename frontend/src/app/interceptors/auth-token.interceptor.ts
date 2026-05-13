import { HttpInterceptorFn } from "@angular/common/http";

const LOGIN_POST_PATH_MARKERS = [
  "/auth/firebase-login",
  "/auth/refresh",
  "/auth/admin",
  "/auth/admin/register",
  "/auth/delivery",
];

function isAuthLoginPost(req: { method: string; url: string }): boolean {
  if (req.method !== "POST") return false;
  return LOGIN_POST_PATH_MARKERS.some((m) => req.url.includes(m));
}

/**
 * Sends JWT as Authorization Bearer when sessionStorage has authToken.
 * Fixes iOS/Safari when cross-site HttpOnly cookies (Netlify → Render) are not stored or sent.
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (isAuthLoginPost(req)) {
    return next(req);
  }
  if (typeof window === "undefined") {
    return next(req);
  }
  const token = sessionStorage.getItem("authToken") || localStorage.getItem("authToken");
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
