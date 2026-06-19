import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { BrowserRouter } from "react-router-dom";
import { isCapacitorNative } from "@/lib/androidOverlayBack";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeSync } from "@/components/ThemeSync";
import { LocaleSync } from "@/components/LocaleSync";
import { MeProvider } from "@/contexts/MeContext";
import { MyMarketListingsProvider } from "@/contexts/MyMarketListingsContext";
import { VisibleMediaTypesProvider } from "@/contexts/VisibleMediaTypesContext";
import { LogCompleteProvider } from "@/contexts/LogCompleteContext";
import { BoardGameMatchCompleteProvider } from "@/contexts/BoardGameMatchCompleteContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApiWakePing } from "@/components/ApiWakePing";
import { ColdStartLoader } from "@/components/ColdStartLoader";
import { AuthSigningOverlay } from "@/components/AuthSigningOverlay";
import { AppVersionModal } from "@/components/AppVersionModal";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { MobileAppInstallBanner } from "@/components/MobileAppInstallBanner";
import { AppVersionProvider } from "@/contexts/AppVersionContext";
import App from "./App";
import { CapacitorAndroidIntegration } from "@/components/CapacitorAndroidIntegration";
import { LogsPageCacheInit } from "@/components/LogsPageCacheInit";
import { initSentry } from "@/lib/sentry";
import "./fonts.css";
import "./index.css";

initSentry();

const reducedMotion = isCapacitorNative() ? "always" : "user";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion={reducedMotion}>
    <ThemeProvider>
      <LocaleProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <AppVersionProvider>
                <MeProvider>
                  <MyMarketListingsProvider>
                  <VisibleMediaTypesProvider>
                    <LogCompleteProvider>
                      <BoardGameMatchCompleteProvider>
                      <CapacitorAndroidIntegration />
                      <LogsPageCacheInit />
                      <ThemeSync />
                      <LocaleSync />
                      <ColdStartLoader />
                      <AuthSigningOverlay />
                      <ApiWakePing />
                      <App />
                      <CookieConsentBanner />
                      <MobileAppInstallBanner />
                      <AppVersionModal />
                      </BoardGameMatchCompleteProvider>
                    </LogCompleteProvider>
                  </VisibleMediaTypesProvider>
                  </MyMarketListingsProvider>
                </MeProvider>
              </AppVersionProvider>
              <Toaster
                position="top-center"
                richColors
                duration={2500}
                mobileOffset={{ top: "5rem" }}
                expand
                gap={12}
                visibleToasts={6}
              />
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </LocaleProvider>
    </ThemeProvider>
    </MotionConfig>
  </React.StrictMode>
);
