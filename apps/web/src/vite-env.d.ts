/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_WEB_ORIGIN?: string;
  /** Shown in Privacy / Terms / FAQ when interpolating support contact (optional). */
  readonly VITE_SUPPORT_EMAIL?: string;
  /** Sentry browser DSN; leave unset to disable client error reporting. */
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
}
