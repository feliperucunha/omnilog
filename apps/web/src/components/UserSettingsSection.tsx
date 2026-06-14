import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { CityAutocomplete, type CityValue } from "@/components/CityAutocomplete";
import { apiFetch, invalidateApiCache } from "@/lib/api";
import { useLocale } from "@/contexts/LocaleContext";
import { useMe } from "@/contexts/MeContext";
import { showErrorToast } from "@/lib/errorToast";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function isValidPassword(p: string): boolean {
  return p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p);
}

export function UserSettingsSection() {
  const { t } = useLocale();
  const { me, refetch: refetchMe } = useMe();
  const [cityValue, setCityValue] = useState<CityValue | null>(null);
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (me?.city && me?.cityLabel) {
      setCityValue({
        city: me.city,
        cityLabel: me.cityLabel,
        countryCode: me.country ?? null,
      });
    }
    setPhone(me?.phone ?? "");
  }, [me?.city, me?.cityLabel, me?.country, me?.phone]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!cityValue) {
      showErrorToast(t, "E001");
      return;
    }
    setSavingProfile(true);
    try {
      await apiFetch("/settings/user-profile", {
        method: "PUT",
        body: JSON.stringify({
          city: cityValue.city,
          cityLabel: cityValue.cityLabel,
          ...(cityValue.countryCode && { country: cityValue.countryCode }),
          phone: phone.trim() || undefined,
        }),
      });
      invalidateApiCache("/me");
      await refetchMe();
      toast.success(t("userSettings.saved"));
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidPassword(newPassword)) {
      toast.error(t("validation.passwordLettersAndNumbers"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("register.passwordsDoNotMatch"));
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("userSettings.passwordChanged"));
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={(e) => void handleSaveProfile(e)} className="flex flex-col gap-4">
        <CityAutocomplete
          label={t("userSettings.city")}
          value={cityValue}
          onChange={setCityValue}
          placeholder={t("userSettings.cityPlaceholder")}
          required
        />
        <div className="space-y-2">
          <Label>{t("userSettings.phone")}</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("userSettings.phonePlaceholder")}
            autoComplete="tel"
          />
          <p className="text-xs text-[var(--color-light)]">{t("userSettings.phoneHint")}</p>
        </div>
        <Button type="submit" disabled={savingProfile || !cityValue}>
          {savingProfile ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              {t("common.saving")}
            </>
          ) : (
            t("common.save")
          )}
        </Button>
      </form>

      <div className="border-t border-[var(--color-surface-border)] pt-6">
        <h3 className="mb-4 font-semibold text-[var(--color-lightest)]">
          {t("userSettings.changePassword")}
        </h3>
        <form onSubmit={(e) => void handleChangePassword(e)} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label>{t("userSettings.currentPassword")}</Label>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("userSettings.newPassword")}</Label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("userSettings.confirmPassword")}</Label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              className={cn(
                confirmPassword &&
                  newPassword !== confirmPassword &&
                  "border-red-500 focus-visible:ring-red-500"
              )}
            />
          </div>
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t("common.saving")}
              </>
            ) : (
              t("userSettings.changePassword")
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
