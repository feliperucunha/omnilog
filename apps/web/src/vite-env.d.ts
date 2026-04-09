/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_WEB_ORIGIN?: string;
  /** Android applicationId; used for Play Store subscription management links. */
  readonly VITE_ANDROID_PACKAGE_ID?: string;
  /** Google Play subscription product ids (must match Play Console and API env). */
  readonly VITE_GOOGLE_PLAY_PRODUCT_MONTHLY?: string;
  readonly VITE_GOOGLE_PLAY_PRODUCT_YEARLY?: string;
  /** Shown in Privacy / Terms / FAQ when interpolating support contact (optional). */
  readonly VITE_SUPPORT_EMAIL?: string;
  /** Sentry browser DSN; leave unset to disable client error reporting. */
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
}
