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
import { AuthNavbar } from "@/components/AuthNavbar";
import { toast } from "sonner";
import { apiFetch, ApiValidationError } from "@/lib/api";
import type { AuthResponse } from "@dogument/shared";
import { modalContentVariants } from "@/lib/animations";
import { cn } from "@/lib/utils";

function isValidPassword(p: string): boolean {
  return p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p);
}

type FieldErrors = Partial<Record<"username" | "email" | "password" | "confirmPassword" | "country", string>>;

export function Register() {
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const { login } = useAuth();
  const navigate = useNavigate();

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    if (!username.trim()) errors.username = t("register.username") + " is required";
    else if (username.trim().length < 2) errors.username = "At least 2 characters";
    else if (!/^[a-zA-Z0-9_-]+$/.test(username.trim()))
      errors.username = "Only letters, numbers, underscore and hyphen";
    if (!email.trim()) errors.email = t("register.email") + " is required";
    if (!password) errors.password = t("validation.passwordLettersAndNumbers");
    else if (!isValidPassword(password)) errors.password = t("validation.passwordLettersAndNumbers");
    if (password !== confirmPassword) errors.confirmPassword = t("register.passwordsDoNotMatch");
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error(t("toast.emailPasswordRequired"));
      return;
    }
    setFieldErrors({});
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
      await login(data.token, { ...data.user, onboarded: data.user.onboarded ?? false });
      toast.success(t("toast.accountCreated"));
      navigate(data.user.onboarded ? "/" : "/onboarding", { replace: true });
    } catch (err) {
      if (err instanceof ApiValidationError) {
        const mapped: FieldErrors = {};
        for (const [key, value] of Object.entries(err.fieldErrors)) {
          if (["username", "email", "password", "confirmPassword", "country"].includes(key)) {
            mapped[key as keyof FieldErrors] = value;
          }
        }
        setFieldErrors(mapped);
        toast.error(err.message);
      } else {
        const msg = err instanceof Error ? err.message : t("toast.registrationFailed");
        if (msg.includes("Email") || msg.includes("email")) setFieldErrors((p) => ({ ...p, email: msg }));
        else if (msg.includes("Username") || msg.includes("username")) setFieldErrors((p) => ({ ...p, username: msg }));
        else setFieldErrors({});
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-darkest)]">
      <AuthNavbar />
      <div className="flex flex-1 items-center justify-center p-4">
      <motion.div
        initial="initial"
        animate="animate"
        variants={modalContentVariants}
        className="w-full max-w-[400px]"
      >
        <Card className="w-full border-[var(--color-surface-border)] bg-[var(--color-dark)] shadow-[var(--shadow-modal)]">
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
                    onChange={(e) => { setUsername(e.target.value); clearFieldError("username"); }}
                    required
                    minLength={2}
                    maxLength={32}
                    className={cn(fieldErrors.username && "border-red-500 focus-visible:ring-red-500")}
                    aria-invalid={!!fieldErrors.username}
                    aria-describedby={fieldErrors.username ? "register-username-error" : undefined}
                  />
                  {fieldErrors.username && (
                    <p id="register-username-error" className="text-xs text-red-500" role="alert">
                      {fieldErrors.username}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("register.email")}</Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder={t("common.placeholderEmail")}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                    required
                    className={cn(fieldErrors.email && "border-red-500 focus-visible:ring-red-500")}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
                  />
                  {fieldErrors.email && (
                    <p id="register-email-error" className="text-xs text-red-500" role="alert">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("register.country")}</Label>
                  <select
                    className={cn(
                      "flex h-10 w-full rounded-md border bg-[var(--color-darkest)] px-3 py-2 text-sm text-[var(--color-lightest)] ring-offset-[var(--color-darkest)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-dark)] disabled:cursor-not-allowed disabled:opacity-50",
                      fieldErrors.country ? "border-red-500 focus:ring-red-500" : "border-[var(--color-mid)] focus:ring-[var(--color-mid)]"
                    )}
                    value={country}
                    onChange={(e) => { setCountry(e.target.value); clearFieldError("country"); }}
                    aria-label={t("register.country")}
                    aria-invalid={!!fieldErrors.country}
                  >
                    <option value="">{t("register.countryRestOfWorld")}</option>
                    <option value="BR">{t("register.countryBrazil")}</option>
                  </select>
                  {fieldErrors.country && (
                    <p className="text-xs text-red-500" role="alert">{fieldErrors.country}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("register.password")}</Label>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={t("common.placeholderPasswordRegister")}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                    required
                    minLength={8}
                    className={cn(fieldErrors.password && "border-red-500 focus-visible:ring-red-500")}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "register-password-error" : undefined}
                  />
                  {fieldErrors.password && (
                    <p id="register-password-error" className="text-xs text-red-500" role="alert">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("register.confirmPassword")}</Label>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder={t("common.placeholderPasswordRegister")}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
                    required
                    minLength={8}
                    className={cn(fieldErrors.confirmPassword && "border-red-500 focus-visible:ring-red-500")}
                    aria-invalid={!!fieldErrors.confirmPassword}
                    aria-describedby={fieldErrors.confirmPassword ? "register-confirmPassword-error" : undefined}
                  />
                  {fieldErrors.confirmPassword && (
                    <p id="register-confirmPassword-error" className="text-xs text-red-500" role="alert">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
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
    </div>
  );
}
