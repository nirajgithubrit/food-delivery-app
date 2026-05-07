import {
  ApplicationConfig,
  ErrorHandler,
  importProvidersFrom,
  provideZoneChangeDetection,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";

import { routes } from "./app.routes";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { GoogleMapsModule } from "@angular/google-maps";
import { apiResponseInterceptor } from "./interceptors/api-response.interceptor";
import { AppErrorHandler } from "./core/errors/app-error.handler";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([apiResponseInterceptor])),
    importProvidersFrom(GoogleMapsModule),
    { provide: ErrorHandler, useClass: AppErrorHandler },
  ],
};
