import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";
import { AnimatedOutlet } from "@/components/AnimatedOutlet";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ResetPassword } from "@/pages/ResetPassword";
import { LogComplete } from "@/pages/LogComplete";
import { Onboarding } from "@/pages/Onboarding";
import { Dashboard } from "@/pages/Dashboard";
import { Search } from "@/pages/Search";
import { ItemPage } from "@/pages/ItemPage";
import { MediaLogs } from "@/pages/MediaLogs";
import { Settings } from "@/pages/Settings";
import { About } from "@/pages/About";
import { Tiers } from "@/pages/Tiers";

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
    const allowed = ["/onboarding", "/login", "/register", "/forgot-password", "/reset-password", "/log-complete"];
    if (!allowed.includes(location.pathname)) return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

const DashboardOrSearch = () => {
  const { token, initializing } = useAuth();
  if (initializing) return null;
  if (token) return <Dashboard />;
  return <Navigate to="/search" replace />;
};

export default function App() {
  return (
    <RequireOnboarded>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/log-complete" element={<LogComplete />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/" element={<AppLayout />}>
        <Route element={<AnimatedOutlet />}>
          <Route index element={<DashboardOrSearch />} />
          <Route path="search" element={<Search />} />
          <Route path="about" element={<About />} />
          <Route path="tiers" element={<Tiers />} />
          <Route path="item/:mediaType/:id" element={<ItemPage />} />
        <Route path="movies" element={<ProtectedRoute><MediaLogs mediaType="movies" /></ProtectedRoute>} />
          <Route path="tv" element={<ProtectedRoute><MediaLogs mediaType="tv" /></ProtectedRoute>} />
          <Route path="boardgames" element={<ProtectedRoute><MediaLogs mediaType="boardgames" /></ProtectedRoute>} />
          <Route path="games" element={<ProtectedRoute><MediaLogs mediaType="games" /></ProtectedRoute>} />
          <Route path="books" element={<ProtectedRoute><MediaLogs mediaType="books" /></ProtectedRoute>} />
          <Route path="anime" element={<ProtectedRoute><MediaLogs mediaType="anime" /></ProtectedRoute>} />
          <Route path="manga" element={<ProtectedRoute><MediaLogs mediaType="manga" /></ProtectedRoute>} />
          <Route path="comics" element={<ProtectedRoute><MediaLogs mediaType="comics" /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Route>
      </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RequireOnboarded>
  );
}
