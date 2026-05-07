import { ErrorHandler, Injectable, inject } from "@angular/core";
import { ToastService } from "../../shared/services/toast.service";

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);

  handleError(error: unknown): void {
    console.error(error);

    let message = "Something went wrong. Please try again.";
    if (error instanceof Error && error.message) {
      message = error.message;
    }

    // Avoid spamming identical chunk-load errors in dev HMR
    if (message.includes("ChunkLoadError")) {
      return;
    }

    this.toast.error(message);
  }
}
