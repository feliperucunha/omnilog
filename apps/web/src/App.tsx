import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";
import { AnimatedOutlet } from "@/components/AnimatedOutlet";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { ForgotPassword } from "@/pages/ForgotPassword";
import { ResetPassword } from "@/pages/ResetPassword";
import { LogCompleteProvider } from "@/contexts/LogCompleteContext";
import { Onboarding } from "@/pages/Onboarding";
import { Dashboard } from "@/pages/Dashboard";
import { Search } from "@/pages/Search";
import { ItemPage } from "@/pages/ItemPage";
import { Settings } from "@/pages/Settings";
import { About } from "@/pages/About";
import { Tiers } from "@/pages/Tiers";
import { PublicProfile } from "@/pages/PublicProfile";
import { PublicProfileLayout } from "@/layouts/PublicProfileLayout";

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
    const allowed = ["/onboarding", "/login", "/register", "/forgot-password", "/reset-password"];
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
    <LogCompleteProvider>
      <RequireOnboarded>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<AppLayout />}>
            <Route element={<AnimatedOutlet />}>
              <Route index element={<DashboardOrSearch />} />
              <Route path="search" element={<Search />} />
              <Route path="about" element={<About />} />
              <Route path="tiers" element={<Tiers />} />
              <Route path="item/:mediaType/:id" element={<ItemPage />} />
              <Route path="movies" element={<ProtectedRoute><Navigate to="/?category=movies" replace /></ProtectedRoute>} />
              <Route path="tv" element={<ProtectedRoute><Navigate to="/?category=tv" replace /></ProtectedRoute>} />
              <Route path="boardgames" element={<ProtectedRoute><Navigate to="/?category=boardgames" replace /></ProtectedRoute>} />
              <Route path="games" element={<ProtectedRoute><Navigate to="/?category=games" replace /></ProtectedRoute>} />
              <Route path="books" element={<ProtectedRoute><Navigate to="/?category=books" replace /></ProtectedRoute>} />
              <Route path="anime" element={<ProtectedRoute><Navigate to="/?category=anime" replace /></ProtectedRoute>} />
              <Route path="manga" element={<ProtectedRoute><Navigate to="/?category=manga" replace /></ProtectedRoute>} />
              <Route path="comics" element={<ProtectedRoute><Navigate to="/?category=comics" replace /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            </Route>
          </Route>
          <Route path="/:userId" element={<PublicProfileLayout />}>
            <Route index element={<PublicProfile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RequireOnboarded>
    </LogCompleteProvider>
  );
}
