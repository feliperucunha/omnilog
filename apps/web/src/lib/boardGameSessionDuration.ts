import {
  BOARD_GAME_SESSION_DURATION_HOURS,
  type BoardGameSessionDurationHours,
} from "@geeklogs/shared";
import type { TFunction } from "@/contexts/LocaleContext";

const SESSION_DURATION_LOCALE_KEY: Record<BoardGameSessionDurationHours, string> = {
  0.5: "boardGameMatches.sessionDuration_0_5",
  1: "boardGameMatches.sessionDuration_1",
  1.5: "boardGameMatches.sessionDuration_1_5",
  2: "boardGameMatches.sessionDuration_2",
  2.5: "boardGameMatches.sessionDuration_2_5",
  3: "boardGameMatches.sessionDuration_3",
  3.5: "boardGameMatches.sessionDuration_3_5",
  4: "boardGameMatches.sessionDuration_4",
  4.5: "boardGameMatches.sessionDuration_4_5",
  5: "boardGameMatches.sessionDuration_5",
  5.5: "boardGameMatches.sessionDuration_5_5",
  6: "boardGameMatches.sessionDuration_6",
};

export function boardGameSessionDurationLabel(hours: BoardGameSessionDurationHours, t: TFunction): string {
  return t(SESSION_DURATION_LOCALE_KEY[hours]);
}

export function boardGameSessionDurationOptions(t: TFunction): {
  value: string;
  label: string;
}[] {
  return BOARD_GAME_SESSION_DURATION_HOURS.map((hours) => ({
    value: String(hours),
    label: boardGameSessionDurationLabel(hours, t),
  }));
}
