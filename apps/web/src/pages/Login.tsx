import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { COOKIE_SESSION } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import type { AuthResponse } from "@logeverything/shared";
import { modalContentVariants } from "@/lib/animations";

export function Login() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error(t("toast.emailPasswordRequired"));
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
        skipAuthRedirect: true,
      });
      login(COOKIE_SESSION, { ...data.user, onboarded: data.user.onboarded ?? true });
      toast.success(t("toast.welcomeBack"));
      navigate(data.user.onboarded ? "/" : "/onboarding", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[var(--color-darkest)] p-4"
    >
      <motion.div
        initial="initial"
        animate="animate"
        variants={modalContentVariants}
        className="w-full max-w-[400px]"
      >
        <Card className="w-full border-[var(--color-dark)] bg-[var(--color-dark)] shadow-[var(--shadow-modal)]">
          <CardHeader className="text-center">
            <h1 className="flex flex-col gap-0.5 text-2xl font-bold text-[var(--color-lightest)]">
              <span>{t("app.name")}</span>
              <span className="text-lg font-normal text-[var(--color-light)]">
                {t("app.subtitle")}
              </span>
            </h1>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label>{t("login.emailOrUsername")}</Label>
                  <Input
                    type="text"
                    autoComplete="username"
                    placeholder={t("login.emailOrUsername")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("login.password")}</Label>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder={t("common.placeholderPassword")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <p className="text-right text-sm">
                  <Link
                    to="/forgot-password"
                    className="text-[var(--color-light)] underline hover:text-[var(--color-lightest)]"
                  >
                    {t("login.forgotPassword")}
                  </Link>
                </p>
                <motion.div whileTap={{ scale: 0.98 }} transition={{ duration: 0.1 }}>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? t("login.signingIn") : t("login.signIn")}
                  </Button>
                </motion.div>
              </div>
            </form>
            <p className="mt-4 text-center text-sm text-[var(--color-light)]">
              {t("login.noAccount")}{" "}
              <Link
                to="/register"
                className="text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("login.registerLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
