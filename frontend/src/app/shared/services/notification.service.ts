import { Injectable, inject } from "@angular/core";
import { MessagingService } from "./messaging.service";

/**
 * Thin facade so existing code can keep injecting `NotificationService`.
 * Prefer `MessagingService` for new UI (e.g. push permission CTA).
 */
@Injectable({ providedIn: "root" })
export class NotificationService {
  private readonly messaging = inject(MessagingService);

  initForLoggedInUser(): Promise<void> {
    return this.messaging.initForLoggedInUser();
  }

  unregisterFromBackend(): Promise<void> {
    return this.messaging.unregisterFromBackend();
  }
}
