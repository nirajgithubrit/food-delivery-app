import { isPlatformBrowser } from "@angular/common";
import { Injectable, PLATFORM_ID, inject, signal } from "@angular/core";
import {
  type FirebaseApp,
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
} from "firebase/app-check";
import {
  type Auth,
  type ConfirmationResult,
  RecaptchaVerifier,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPhoneNumber,
} from "firebase/auth";
import { environment } from "../../../environments/environment";

/** Must match the element in `login.component.html` (customer flow). */
export const FIREBASE_RECAPTCHA_CONTAINER_ID = "firebase-recaptcha";

function getErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function getErrorMessage(err: unknown): string {
  if (typeof err !== "object" || err === null) return String(err);
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" ? message : "Unknown error";
}

@Injectable({ providedIn: "root" })
export class FirebasePhoneAuthService {
  readonly initialized = signal(false);

  private readonly platformId = inject(PLATFORM_ID);

  private firebaseApp: FirebaseApp | null = null;
  private appCheckInitialized = false;
  private auth: Auth | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  /** True only after `render()` resolved successfully for the current verifier instance. */
  private verifierRenderComplete = false;
  private verifierEnsureChain: Promise<RecaptchaVerifier> | null = null;

  private confirmationResult: ConfirmationResult | null = null;
  private lastPhoneE164 = "";

  private readonly debugEnabled = !environment.production;

  private logDebug(message: string, detail?: unknown): void {
    if (!this.debugEnabled) return;
    const prefix = "[FirebasePhoneAuth]";
    if (detail !== undefined) {
      console.debug(prefix, message, detail);
    } else {
      console.debug(prefix, message);
    }
  }

  private logWarn(message: string, detail?: unknown): void {
    if (detail !== undefined) {
      console.warn(`[FirebasePhoneAuth] ${message}`, detail);
    } else {
      console.warn(`[FirebasePhoneAuth] ${message}`);
    }
  }

  /**
   * Single invisible verifier per phone-auth session: created on first need, reused for resend,
   * destroyed on `resetFlow` / `dispose` or when recycling after captcha-related failures.
   */
  async sendOtp(phone10: string): Promise<void> {
    const auth = this.getAuthInstance();
    const normalized = this.normalizePhone(phone10);
    this.lastPhoneE164 = normalized;

    const appVerifier = await this.ensureInvisibleVerifierReady();
    this.logDebug("signInWithPhoneNumber (send)", { e164: normalized });

    try {
      this.confirmationResult = await signInWithPhoneNumber(
        auth,
        normalized,
        appVerifier,
      );
      this.logDebug("signInWithPhoneNumber OK (confirmation pending)");
    } catch (err: unknown) {
      this.onSendVerificationFailure(err);
      throw err;
    }
  }

  /** Reuses the same rendered `RecaptchaVerifier` as the initial send (Firebase best practice). */
  async resendOtp(): Promise<void> {
    const auth = this.getAuthInstance();
    if (!this.lastPhoneE164) {
      throw new Error("Phone number is required before resending OTP");
    }

    const appVerifier = await this.ensureInvisibleVerifierReady();
    this.logDebug("signInWithPhoneNumber (resend)", { e164: this.lastPhoneE164 });

    try {
      this.confirmationResult = await signInWithPhoneNumber(
        auth,
        this.lastPhoneE164,
        appVerifier,
      );
      this.logDebug("signInWithPhoneNumber OK (resend)");
    } catch (err: unknown) {
      this.onSendVerificationFailure(err);
      throw err;
    }
  }

  async verifyOtp(otpCode: string): Promise<string> {
    const code = String(otpCode || "").trim();
    if (!/^\d{6}$/.test(code)) {
      throw new Error("OTP must be 6 digits");
    }
    if (!this.confirmationResult) {
      throw new Error("Request OTP first");
    }

    this.logDebug("confirmationResult.confirm");
    const credential = await this.confirmationResult.confirm(code);
    const token = await credential.user.getIdToken(true);
    this.logDebug("ID token issued");
    return token;
  }

  resetFlow(): void {
    this.logDebug("resetFlow()");
    this.destroyVerifierAndDom();
    this.confirmationResult = null;
    this.lastPhoneE164 = "";
  }

  dispose(): void {
    this.resetFlow();
  }

  /**
   * Single default app for the SPA. Matches Firebase docs: reuse existing app if already initialized.
   */
  private getOrInitFirebaseApp(): FirebaseApp {
    if (this.firebaseApp) {
      return this.firebaseApp;
    }

    const app = getApps().length
      ? getApp()
      : initializeApp(environment.firebase);

    this.firebaseApp = app;
    this.logDebug("FirebaseApp ready", { projectId: app.options.projectId });

    if (isPlatformBrowser(this.platformId)) {
      this.initAppCheckIfConfigured(app);
    }

    return app;
  }

  /**
   * If App Check is enforced for Auth, Identity Toolkit rejects requests without a valid App Check token
   * (`INVALID_APP_CREDENTIAL`). Initialize once with the same `FirebaseApp` instance.
   */
  private initAppCheckIfConfigured(app: FirebaseApp): void {
    if (this.appCheckInitialized) {
      return;
    }
    const cfg = environment.firebaseAppCheck;
    if (!cfg?.recaptchaEnterpriseSiteKey) {
      return;
    }

    const g = globalThis as unknown as {
      FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
    };
    if (cfg.debugToken !== undefined && cfg.debugToken !== false) {
      g.FIREBASE_APPCHECK_DEBUG_TOKEN =
        cfg.debugToken === true ? true : String(cfg.debugToken);
      this.logDebug("App Check debug token mode", {
        mode: cfg.debugToken === true ? "print-once" : "registered-string",
      });
    }

    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(cfg.recaptchaEnterpriseSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    this.appCheckInitialized = true;
    this.logDebug("App Check initialized (ReCaptcha Enterprise provider)");
  }

  private getAuthInstance(): Auth {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error(
        "Firebase Phone Authentication is only available in the browser (not during SSR/prerender).",
      );
    }
    if (this.auth) return this.auth;

    const app = this.getOrInitFirebaseApp();
    this.auth = getAuth(app);
    void setPersistence(this.auth, browserLocalPersistence);
    this.initialized.set(true);
    this.logDebug("Auth instance ready", { authDomain: app.options.authDomain });
    return this.auth;
  }

  private normalizePhone(phone10: string): string {
    const digits = String(phone10 || "").replace(/\D/g, "");
    const mobile = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!/^\d{10}$/.test(mobile)) {
      throw new Error("Valid 10-digit mobile number required");
    }
    return `+91${mobile}`;
  }

  /**
   * Guarantees a single in-flight initialization: concurrent callers await the same promise.
   * After success, subsequent calls return the same verifier until `destroyVerifierAndDom`.
   */
  private ensureInvisibleVerifierReady(): Promise<RecaptchaVerifier> {
    if (this.verifierEnsureChain) {
      this.logDebug("ensureInvisibleVerifierReady: awaiting in-flight init");
      return this.verifierEnsureChain;
    }
    if (this.recaptchaVerifier && this.verifierRenderComplete) {
      this.logDebug("ensureInvisibleVerifierReady: reuse verifier");
      return Promise.resolve(this.recaptchaVerifier);
    }

    this.verifierEnsureChain = this.createRenderAndCacheVerifier();
    return this.verifierEnsureChain.finally(() => {
      this.verifierEnsureChain = null;
    });
  }

  private async createRenderAndCacheVerifier(): Promise<RecaptchaVerifier> {
    try {
      this.getAuthInstance();

      if (this.recaptchaVerifier) {
        this.logWarn("Replacing existing verifier (incomplete or recycled)");
        this.destroyVerifierInstanceOnly();
      }

      const host = document.getElementById(FIREBASE_RECAPTCHA_CONTAINER_ID);
      if (!host) {
        throw new Error(
          `Missing #${FIREBASE_RECAPTCHA_CONTAINER_ID}. It must remain in the DOM for the customer login view.`,
        );
      }
      host.innerHTML = "";

      await this.waitForDomPaint();

      const auth = this.getAuthInstance();
      this.logDebug("new RecaptchaVerifier (invisible)", {
        container: FIREBASE_RECAPTCHA_CONTAINER_ID,
      });

      const verifier = new RecaptchaVerifier(auth, FIREBASE_RECAPTCHA_CONTAINER_ID, {
        size: "invisible",
        callback: () => this.logDebug("reCAPTCHA solved callback"),
      });

      this.recaptchaVerifier = verifier;
      this.verifierRenderComplete = false;

      this.logDebug("recaptchaVerifier.render() start");
      await verifier.render();
      this.verifierRenderComplete = true;
      this.logDebug("recaptchaVerifier.render() complete");

      return verifier;
    } catch (err: unknown) {
      this.logWarn("createRenderAndCacheVerifier failed", err);
      this.destroyVerifierAndDom();
      throw err;
    }
  }

  /** Two rAFs: layout exists after Angular/CD paints the host (mobile + desktop). */
  private waitForDomPaint(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }

  private onSendVerificationFailure(err: unknown): void {
    const code = getErrorCode(err);
    this.logWarn("sendVerification failed", { code, message: getErrorMessage(err) });

    if (code === "auth/captcha-check-failed") {
      this.logWarn("Recycling verifier after captcha-check-failed");
      this.destroyVerifierAndDom();
      return;
    }

    if (code === "auth/invalid-app-credential") {
      this.logWarn(
        "INVALID_APP_CREDENTIAL: often App Check (enforce Auth) without web App Check, wrong browser API key vs Firebase web app, or GCP API key restrictions. Set environment.firebaseAppCheck with ReCaptcha Enterprise site key (+ debug token on localhost), or disable App Check enforcement for Auth while testing.",
      );
    }
  }

  private destroyVerifierInstanceOnly(): void {
    this.verifierRenderComplete = false;
    if (!this.recaptchaVerifier) return;
    try {
      this.recaptchaVerifier.clear();
    } catch {
      /* ignore */
    }
    this.recaptchaVerifier = null;
  }

  private destroyVerifierAndDom(): void {
    this.destroyVerifierInstanceOnly();
    const el = document.getElementById(FIREBASE_RECAPTCHA_CONTAINER_ID);
    if (el) {
      el.innerHTML = "";
    }
  }
}
