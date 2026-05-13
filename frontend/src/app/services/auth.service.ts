import { HttpBackend, HttpClient } from "@angular/common/http";
import { Injectable, computed, inject, signal } from "@angular/core";
import { Observable, map, tap, throwError } from "rxjs";
import { environment } from "../../environments/environment";

export interface CustomerAuthPayload {
  token: string;
  refreshToken: string;
  role: string;
  user: { id: string; role: string; phone?: string };
}

interface WrappedRefreshResponse {
  success: boolean;
  data: { token: string; refreshToken: string; role?: string };
}

export type AppRole = "customer" | "admin" | "delivery";

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly httpBackend = inject(HttpBackend);
  private readonly rawHttp = new HttpClient(this.httpBackend);
  private readonly baseUrl = environment.apiUrl;

  /** Mirrors sessionStorage for guards and interceptors */
  readonly accessToken = signal<string | null>(this.readAccessToken());
  readonly refreshTokenStored = signal<string | null>(this.readRefreshToken());

  readonly isLoggedIn = computed(
    () => !!(this.accessToken() || this.refreshTokenStored()),
  );

  firebaseLogin(firebaseToken: string, mobile: string): Observable<CustomerAuthPayload> {
    return this.http
      .post<CustomerAuthPayload>(
        `${this.baseUrl}/auth/firebase-login`,
        { firebaseToken, mobile },
        { withCredentials: true },
      )
      .pipe(tap((res) => this.persistTokens(res.token, res.refreshToken)));
  }

  /**
   * Uses HttpBackend so refresh does not recurse through interceptors.
   */
  refreshSession(): Observable<void> {
    const rt = this.readRefreshToken();
    if (!rt) {
      return throwError(() => new Error("No refresh token"));
    }
    return this.rawHttp
      .post<WrappedRefreshResponse>(
        `${this.baseUrl}/auth/refresh`,
        { refreshToken: rt },
        { withCredentials: true },
      )
      .pipe(
        map((body) => {
          if (!body?.success || !body.data?.token || !body.data?.refreshToken) {
            throw new Error("Refresh failed");
          }
          return body.data;
        }),
        tap((d) => this.persistTokens(d.token, d.refreshToken)),
        map(() => undefined),
      );
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this.clearTokens()));
  }

  persistTokens(access: string, refresh: string): void {
    this.setStorage("authToken", access);
    this.setStorage("refreshToken", refresh);
    this.accessToken.set(access);
    this.refreshTokenStored.set(refresh);
  }

  clearTokens(): void {
    this.removeStorage("authToken");
    this.removeStorage("refreshToken");
    this.accessToken.set(null);
    this.refreshTokenStored.set(null);
  }

  /** Admin / rider flows issue a long-lived access JWT only (no refresh). */
  setLegacySession(access: string): void {
    this.setStorage("authToken", access);
    this.removeStorage("refreshToken");
    this.accessToken.set(access);
    this.refreshTokenStored.set(null);
  }

  getCurrentRole(): AppRole | null {
    return this.parseRole(this.accessToken()) || this.parseRole(this.refreshTokenStored());
  }

  clearClientSessionData(): void {
    this.clearTokens();
    this.removeStorage("user");
    this.removeStorage("orderId");
    this.removeStorage("deliveryUser");
    this.removeStorage("deliveryName");
  }

  private readAccessToken(): string | null {
    return this.readStorage("authToken");
  }

  private readRefreshToken(): string | null {
    return this.readStorage("refreshToken");
  }

  private readStorage(key: string): string | null {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  }

  private setStorage(key: string, value: string): void {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  }

  private removeStorage(key: string): void {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }

  private parseRole(token: string | null): AppRole | null {
    if (!token) return null;
    try {
      const payload = token.split(".")[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(atob(normalized)) as { role?: string };
      if (decoded.role === "customer" || decoded.role === "admin" || decoded.role === "delivery") {
        return decoded.role;
      }
      return null;
    } catch {
      return null;
    }
  }
}
