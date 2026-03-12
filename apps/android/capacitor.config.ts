import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dogument.app",
  appName: "Dogument",
  webDir: "../web/dist",
  server: {
    // Allow live reload when using cap run android with dev server (optional)
    // url: "http://YOUR_DEV_MACHINE_IP:5173",
    // cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  // Use native HTTP so API requests bypass WebView CORS (Android sends Origin: http://localhost).
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0,
    },
  },
};

export default config;
