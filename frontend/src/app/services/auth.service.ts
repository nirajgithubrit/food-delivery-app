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
    const rt = sessionStorage.getItem("refreshToken");
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
    sessionStorage.setItem("authToken", access);
    sessionStorage.setItem("refreshToken", refresh);
    this.accessToken.set(access);
    this.refreshTokenStored.set(refresh);
  }

  clearTokens(): void {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("refreshToken");
    this.accessToken.set(null);
    this.refreshTokenStored.set(null);
  }

  /** Admin / rider flows issue a long-lived access JWT only (no refresh). */
  setLegacySession(access: string): void {
    sessionStorage.setItem("authToken", access);
    sessionStorage.removeItem("refreshToken");
    this.accessToken.set(access);
    this.refreshTokenStored.set(null);
  }

  private readAccessToken(): string | null {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem("authToken");
  }

  private readRefreshToken(): string | null {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem("refreshToken");
  }
}
