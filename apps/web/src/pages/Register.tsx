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

function isValidPassword(p: string): boolean {
  return p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p);
}

export function Register() {
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password) {
      toast.error(t("toast.emailPasswordRequired"));
      return;
    }
    if (username.trim().length < 2) {
      toast.error(t("register.username") + ": " + "At least 2 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      toast.error(t("register.username") + ": " + "Only letters, numbers, underscore and hyphen");
      return;
    }
    if (!isValidPassword(password)) {
      toast.error(t("validation.passwordLettersAndNumbers"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("register.passwordsDoNotMatch"));
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          ...(country.trim().length === 2 && { country: country.trim().toUpperCase() }),
        }),
      });
      login(COOKIE_SESSION, { ...data.user, onboarded: data.user.onboarded ?? false });
      toast.success(t("toast.accountCreated"));
      navigate(data.user.onboarded ? "/" : "/onboarding", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.registrationFailed"));
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
            <h1 className="text-2xl font-bold text-[var(--color-lightest)]">
              {t("register.title")}
            </h1>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label>{t("register.username")}</Label>
                  <Input
                    type="text"
                    autoComplete="username"
                    placeholder={t("common.placeholderUsername")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={2}
                    maxLength={32}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("register.email")}</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("common.placeholderEmail")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("register.country")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-[var(--color-mid)] bg-[var(--color-darkest)] px-3 py-2 text-sm text-[var(--color-lightest)] ring-offset-[var(--color-darkest)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)]"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    aria-label={t("register.country")}
                  >
                    <option value="">{t("register.countryRestOfWorld")}</option>
                    <option value="BR">{t("register.countryBrazil")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t("register.password")}</Label>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={t("common.placeholderPasswordRegister")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("register.confirmPassword")}</Label>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={t("common.placeholderPasswordRegister")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <motion.div whileTap={{ scale: 0.98 }} transition={{ duration: 0.1 }}>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? t("register.creatingAccount") : t("register.register")}
                  </Button>
                </motion.div>
              </div>
            </form>
            <p className="mt-4 text-center text-sm text-[var(--color-light)]">
              {t("register.haveAccount")}{" "}
              <Link
                to="/login"
                className="text-[var(--color-lightest)] underline hover:no-underline"
              >
                {t("register.signInLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
