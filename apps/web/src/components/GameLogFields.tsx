import { useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LogDateFields } from "@/components/LogDateFields";
import { GamePlatformIcon } from "@/components/GamePlatformIcon";
import { useLocale } from "@/contexts/LocaleContext";
import { buildGamePlatformSelectOptions, rememberGamePlatform } from "@/lib/gamePlatforms";

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
    () =>
      buildGamePlatformSelectOptions(platformOptions, gamePlatform).map((option) =>
        option.value
          ? {
              ...option,
              accessibleLabel: option.label,
              label: (
                <span className="inline-flex min-w-0 items-center gap-2">
                  <GamePlatformIcon platform={option.value} />
                  <span className="truncate">{option.label}</span>
                </span>
              ),
            }
          : option
      ),
    [platformOptions, gamePlatform]
  );

  const handlePlatformChange = useCallback(
    (value: string) => {
      rememberGamePlatform(value);
      onGamePlatformChange(value);
    },
    [onGamePlatformChange]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label className="text-sm text-[var(--color-lightest)]">{t("gameLog.platform")}</Label>
        <Select
          value={gamePlatform}
          onValueChange={handlePlatformChange}
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
