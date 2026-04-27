import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";
import { AnimatedOutlet } from "@/components/AnimatedOutlet";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ResetPassword } from "@/pages/ResetPassword";
import { InvalidApiKeyProvider } from "@/contexts/InvalidApiKeyContext";
import { Onboarding } from "@/pages/Onboarding";
import { Dashboard } from "@/pages/Dashboard";
import { PublicProfile } from "@/pages/PublicProfile";
import { PublicProfileLayout } from "@/layouts/PublicProfileLayout";
const Statistics = lazy(() => import("@/pages/Statistics").then((m) => ({ default: m.Statistics })));
const Search = lazy(() => import("@/pages/Search").then((m) => ({ default: m.Search })));
const ItemPage = lazy(() => import("@/pages/ItemPage").then((m) => ({ default: m.ItemPage })));
const Settings = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.Settings })));
const About = lazy(() => import("@/pages/About").then((m) => ({ default: m.About })));
const Tiers = lazy(() => import("@/pages/Tiers").then((m) => ({ default: m.Tiers })));
const FAQ = lazy(() => import("@/pages/FAQ").then((m) => ({ default: m.FAQ })));
const Privacy = lazy(() => import("@/pages/Privacy").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("@/pages/Terms").then((m) => ({ default: m.Terms })));

function LazyRouteFallback() {
  return (
    <div
      className="min-h-[28vh] animate-pulse rounded-xl bg-[var(--color-mid)]/10"
      aria-hidden
    />
  );
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, initializing } = useAuth();
  if (initializing) return null;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RequireOnboarded = ({ children }: { children: React.ReactNode }) => {
  const { token, user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return null;
  if (token && user && user.onboarded === false) {
    const allowed = [
      "/onboarding",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/faq",
      "/privacy",
      "/terms",
      "/tiers",
    ];
    if (!allowed.includes(location.pathname)) return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <>
      <RequireOnboarded>
        <InvalidApiKeyProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<AppLayout />}>
            <Route
              element={
                <Suspense fallback={<LazyRouteFallback />}>
                  <AnimatedOutlet />
                </Suspense>
              }
            >
              <Route index element={<Search />} />
              <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
              <Route path="search" element={<Search />} />
              <Route path="about" element={<About />} />
              <Route path="faq" element={<FAQ />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="tiers" element={<Tiers />} />
              <Route path="item/:mediaType/:id" element={<ItemPage />} />
              <Route path="movies" element={<ProtectedRoute><Navigate to="/dashboard?category=movies" replace /></ProtectedRoute>} />
              <Route path="tv" element={<ProtectedRoute><Navigate to="/dashboard?category=tv" replace /></ProtectedRoute>} />
              <Route path="boardgames" element={<ProtectedRoute><Navigate to="/dashboard?category=boardgames" replace /></ProtectedRoute>} />
              <Route path="games" element={<ProtectedRoute><Navigate to="/dashboard?category=games" replace /></ProtectedRoute>} />
              <Route path="books" element={<ProtectedRoute><Navigate to="/dashboard?category=books" replace /></ProtectedRoute>} />
              <Route path="anime" element={<ProtectedRoute><Navigate to="/dashboard?category=anime" replace /></ProtectedRoute>} />
              <Route path="manga" element={<ProtectedRoute><Navigate to="/dashboard?category=manga" replace /></ProtectedRoute>} />
              <Route path="comics" element={<ProtectedRoute><Navigate to="/dashboard?category=comics" replace /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            </Route>
          </Route>
          <Route path="/:userId" element={<PublicProfileLayout />}>
            <Route index element={<PublicProfile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </InvalidApiKeyProvider>
      </RequireOnboarded>
    </>
  );
}
