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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "./App";
import "./fonts.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LocaleProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <AuthProvider>
              <MeProvider>
                <VisibleMediaTypesProvider>
                  <ThemeSync />
                  <LocaleSync />
                  <App />
                </VisibleMediaTypesProvider>
              </MeProvider>
            <Toaster position="top-center" richColors />
          </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </LocaleProvider>
    </ThemeProvider>
  </React.StrictMode>
);
