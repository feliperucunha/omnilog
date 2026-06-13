export const BOARD_GAME_SESSION_DURATION_HOURS = [
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6,
] as const;

export type BoardGameSessionDurationHours = (typeof BOARD_GAME_SESSION_DURATION_HOURS)[number];

export const DEFAULT_BOARD_GAME_SESSION_DURATION_HOURS: BoardGameSessionDurationHours = 1;

export function isBoardGameSessionDurationHours(value: number): value is BoardGameSessionDurationHours {
  return (BOARD_GAME_SESSION_DURATION_HOURS as readonly number[]).includes(value);
}
