import { useRef, useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { useLocale, LOCALE_OPTIONS, type Locale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { apiFetch, invalidateApiCache } from "@/lib/api";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/errorToast";
import { BOARD_GAME_PROVIDERS, type BoardGameProvider } from "@geeklogs/shared";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { Drawer, DrawerContent, DrawerFooter } from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  "pt-BR": "PT",
  es: "ES",
};

interface PreferencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreferencesModal({ open, onOpenChange }: PreferencesModalProps) {
  const { t, locale, setLocale } = useLocale();
  const { token } = useAuth();
  const { me, refetch: refetchMe } = useMe();
  const isMobile = useIsMobile();
  const [savingBoardGameProvider, setSavingBoardGameProvider] = useState(false);
  const drawerCloseRef = useRef<(() => void) | null>(null);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    if (token) {
      apiFetch("/settings/locale", {
        method: "PUT",
        body: JSON.stringify({ locale: newLocale }),
      }).catch(() => {});
    }
  };

  const handleBoardGameProviderChange = async (provider: BoardGameProvider) => {
    if (!me || me.boardGameProvider === provider) return;
    setSavingBoardGameProvider(true);
    try {
      await apiFetch("/settings/board-game-provider", {
        method: "PUT",
        body: JSON.stringify({ provider }),
      });
      await refetchMe();
      invalidateApiCache("/search");
      toast.success(t("settings.boardGameProviderSaved"));
    } catch (err) {
      showErrorToast(t, "E008", { originalError: err });
    } finally {
      setSavingBoardGameProvider(false);
    }
  };

  const close = () => onOpenChange(false);

  const body = (
    <div className="flex flex-col gap-8 max-md:gap-7">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[var(--color-lightest)]">{t("nav.theme")}</h3>
          <p className="text-xs text-[var(--color-light)]">{t("topbar.preferencesThemeHint")}</p>
        </div>
        <div className="flex min-h-[48px] items-center justify-between rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/40 px-4 py-3">
          <span className="text-sm text-[var(--color-light)]">{t("topbar.preferencesThemeRow")}</span>
          <ThemeSwitcher />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[var(--color-lightest)]">{t("settings.language")}</h3>
          <p className="text-xs text-[var(--color-light)]">{t("topbar.preferencesLanguageHint")}</p>
        </div>
        <ToggleGroup
          type="single"
          value={locale}
          onValueChange={(v) => v && handleLocaleChange(v as Locale)}
          className="grid w-full grid-cols-3 gap-2 rounded-xl border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/40 p-2"
          aria-label={t("settings.language")}
        >
          {LOCALE_OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              className={cn(
                "h-11 flex-1 rounded-lg text-sm font-semibold shadow-none",
                "data-[state=on]:bg-[var(--color-mid)]/50 data-[state=on]:text-[var(--color-lightest)]"
              )}
              aria-label={opt.label}
            >
              {LOCALE_SHORT_LABELS[opt.value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      {me && (
        <section
          className={cn(
            "flex flex-col gap-3 rounded-xl border border-[var(--color-mid)]/25 bg-[var(--color-darkest)]/30 p-4 max-md:p-3.5",
            savingBoardGameProvider && "pointer-events-none opacity-60"
          )}
          aria-busy={savingBoardGameProvider}
        >
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-[var(--color-lightest)]">
              {t("settings.boardGameProviderLabel")}
            </h3>
            <p className="text-xs leading-relaxed text-[var(--color-light)]">
              {t("settings.boardGameProviderIntro")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {BOARD_GAME_PROVIDERS.map((provider) => {
              const selected = (me.boardGameProvider ?? "bgg") === provider;
              const label =
                provider === "bgg"
                  ? t("settings.boardGameProviderBgg")
                  : t("settings.boardGameProviderLudopedia");
              const hint =
                provider === "bgg" ? t("topbar.boardGameBggHint") : t("topbar.boardGameLudopediaHint");
              return (
                <button
                  key={provider}
                  type="button"
                  disabled={savingBoardGameProvider}
                  onClick={() => void handleBoardGameProviderChange(provider)}
                  className={cn(
                    "flex min-h-[56px] flex-col items-stretch justify-center rounded-xl border px-3 py-3 text-left transition-colors max-md:min-h-[52px] max-md:px-3 max-md:py-2.5",
                    selected
                      ? "border-[var(--btn-gradient-start)] bg-[var(--btn-gradient-start)]/12 ring-2 ring-[var(--btn-gradient-start)]/35"
                      : "border-[var(--color-mid)]/40 bg-[var(--color-dark)] hover:border-[var(--color-mid)]/70 active:bg-[var(--color-darkest)]/50"
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold leading-tight text-[var(--color-lightest)]">
                      {label}
                    </span>
                    {savingBoardGameProvider && selected && (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--btn-gradient-start)]" aria-hidden />
                    )}
                  </span>
                  <span className="mt-1 text-[11px] leading-snug text-[var(--color-light)]">{hint}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );

  const mobileHeader = (
    <div className="flex items-start gap-3 border-b border-[var(--color-mid)]/25 pb-4 max-md:pb-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-mid)]/20 text-[var(--color-lightest)]">
        <SlidersHorizontal className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <h2 id="preferences-modal-title" className="text-lg font-semibold text-[var(--color-lightest)] max-md:text-xl">
          {t("topbar.preferences")}
        </h2>
        <p className="mt-1 text-sm leading-snug text-[var(--color-light)]">{t("topbar.preferencesSubtitle")}</p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          onClose={close}
          onReady={(requestClose) => {
            drawerCloseRef.current = requestClose;
          }}
          mobileHeight="95%"
          className="flex max-h-[95dvh] flex-col gap-0 px-4 pb-0 pt-2"
          aria-labelledby="preferences-modal-title"
        >
          <div className="px-2 pb-2 pt-2">
            {mobileHeader}
            <div className="pt-6">{body}</div>
          </div>
          <DrawerFooter className="border-t border-[var(--color-surface-border)] px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              className="w-full max-md:min-h-[48px]"
              onClick={() => drawerCloseRef.current?.() ?? close()}
            >
              {t("common.close")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClose={close}
        className="flex max-h-[min(90vh,640px)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <div className="overflow-y-auto px-6 py-5">
          <DialogHeader className="space-y-0 border-b border-[var(--color-mid)]/25 pb-4 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-mid)]/20 text-[var(--color-lightest)]">
                <SlidersHorizontal className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="text-lg text-[var(--color-lightest)]">{t("topbar.preferences")}</DialogTitle>
                <p className="text-sm leading-snug text-[var(--color-light)]">{t("topbar.preferencesSubtitle")}</p>
              </div>
            </div>
          </DialogHeader>
          <div className="pt-6">{body}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
