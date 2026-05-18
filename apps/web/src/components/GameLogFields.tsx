import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LogDateFields } from "@/components/LogDateFields";
import { useLocale } from "@/contexts/LocaleContext";
import { buildGamePlatformSelectOptions } from "@/lib/gamePlatforms";

export function GameLogFields({
  gamePlatform,
  onGamePlatformChange,
  platformOptions,
  startedAt,
  onStartedAtChange,
  completedAt,
  onCompletedAtChange,
  disabled,
}: {
  gamePlatform: string;
  onGamePlatformChange: (v: string) => void;
  platformOptions?: string[] | null;
  startedAt: string;
  onStartedAtChange: (v: string) => void;
  completedAt: string;
  onCompletedAtChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();

  const platformSelectOptions = useMemo(
    () => buildGamePlatformSelectOptions(platformOptions, gamePlatform),
    [platformOptions, gamePlatform]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label className="text-sm text-[var(--color-lightest)]">{t("gameLog.platform")}</Label>
        <Select
          value={gamePlatform}
          onValueChange={onGamePlatformChange}
          options={platformSelectOptions}
          placeholder={t("gameLog.platformPlaceholder")}
          disabled={disabled}
          contentScrollable
          aria-label={t("gameLog.platform")}
        />
      </div>
      <LogDateFields
        startedAt={startedAt}
        onStartedAtChange={onStartedAtChange}
        completedAt={completedAt}
        onCompletedAtChange={onCompletedAtChange}
        disabled={disabled}
      />
    </div>
  );
}
