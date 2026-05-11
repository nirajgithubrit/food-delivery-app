import { Injectable } from "@angular/core";

/**
 * Web push was previously wired to Firebase Cloud Messaging.
 * Stubbed until a non-Firebase provider is integrated.
 */
@Injectable({ providedIn: "root" })
export class PushNotificationService {
  initForLoggedInUser(): Promise<void> {
    return Promise.resolve();
  }
}
