import {
  ApplicationConfig,
  ErrorHandler,
  importProvidersFrom,
  isDevMode,
  provideZoneChangeDetection,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideServiceWorker } from "@angular/service-worker";

import { routes } from "./app.routes";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { GoogleMapsModule } from "@angular/google-maps";
import { apiErrorInterceptor } from "./interceptors/api-error.interceptor";
import { apiResponseInterceptor } from "./interceptors/api-response.interceptor";
import { authRefreshInterceptor } from "./interceptors/auth-refresh.interceptor";
import { authTokenInterceptor } from "./interceptors/auth-token.interceptor";
import { AppErrorHandler } from "./core/errors/app-error.handler";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([
        authTokenInterceptor,
        authRefreshInterceptor,
        apiErrorInterceptor,
        apiResponseInterceptor,
      ]),
    ),
    importProvidersFrom(GoogleMapsModule),
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideServiceWorker("ngsw-worker.js", {
      enabled: !isDevMode(),
      registrationStrategy: "registerWhenStable:30000",
    }),
  ],
};
