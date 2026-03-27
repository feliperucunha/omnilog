import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeSync } from "@/components/ThemeSync";
import { LocaleSync } from "@/components/LocaleSync";
import { MeProvider } from "@/contexts/MeContext";
import { VisibleMediaTypesProvider } from "@/contexts/VisibleMediaTypesContext";
import { LogCompleteProvider } from "@/contexts/LogCompleteContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApiWakePing } from "@/components/ApiWakePing";
import { ColdStartLoader } from "@/components/ColdStartLoader";
import { AppVersionModal } from "@/components/AppVersionModal";
import { AppVersionProvider } from "@/contexts/AppVersionContext";
import App from "./App";
import { CapacitorAndroidIntegration } from "@/components/CapacitorAndroidIntegration";
import { initSentry } from "@/lib/sentry";
import "./fonts.css";
import "./index.css";

initSentry();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <AppVersionProvider>
                <MeProvider>
                  <VisibleMediaTypesProvider>
                    <LogCompleteProvider>
                      <CapacitorAndroidIntegration />
                      <ThemeSync />
                      <LocaleSync />
                      <ColdStartLoader />
                      <ApiWakePing />
                      <App />
                      <AppVersionModal />
                    </LogCompleteProvider>
                  </VisibleMediaTypesProvider>
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
  </React.StrictMode>
);
