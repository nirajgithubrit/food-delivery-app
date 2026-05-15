import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";

/** Chrome extensions often reject `runtime.sendMessage` on the page — not app bugs. */
function suppressExtensionPromiseNoise(): void {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = String(
      (event.reason as Error)?.message ?? event.reason ?? "",
    );
    if (
      msg.includes("message channel closed") ||
      msg.includes("asynchronous response") ||
      msg.includes("Extension context invalidated")
    ) {
      event.preventDefault();
    }
  });
}

suppressExtensionPromiseNoise();

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
