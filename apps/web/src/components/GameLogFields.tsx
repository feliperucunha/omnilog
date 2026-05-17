import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogDateFields } from "@/components/LogDateFields";
import { useLocale } from "@/contexts/LocaleContext";

const GAME_PLATFORM_MAX = 80;

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
  const listId = useMemo(() => `game-platform-${Math.random().toString(36).slice(2, 9)}`, []);
  const options = useMemo(() => {
    const fromItem = (platformOptions ?? []).filter(Boolean);
    const current = gamePlatform.trim();
    const merged = current && !fromItem.includes(current) ? [...fromItem, current] : fromItem;
    return [...new Set(merged)].sort((a, b) => a.localeCompare(b));
  }, [platformOptions, gamePlatform]);

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <Label className="text-sm text-[var(--color-lightest)]">{t("gameLog.platform")}</Label>
        <Input
          type="text"
          list={options.length > 0 ? listId : undefined}
          value={gamePlatform}
          onChange={(e) => onGamePlatformChange(e.target.value.slice(0, GAME_PLATFORM_MAX))}
          disabled={disabled}
          placeholder={t("gameLog.platformPlaceholder")}
          className="w-full"
          aria-label={t("gameLog.platform")}
        />
        {options.length > 0 && (
          <datalist id={listId}>
            {options.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        )}
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
