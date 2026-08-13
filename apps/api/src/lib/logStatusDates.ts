import { statusSetsCompletedAt, statusSetsStartedAt } from "@geeklogs/shared";

function parseManualLogDate(value: string): Date | null {
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ResolveLogStatusDatesInput = {
  status: string | null | undefined;
  previousStatus?: string | null | undefined;
  statusProvided: boolean;
  bodyStartedAt: string | null | undefined;
  bodyCompletedAt: string | null | undefined;
  existingStartedAt: Date | null;
  existingCompletedAt: Date | null;
  now?: Date;
};

export type ResolveLogStatusDatesResult = {
  startedAt: Date | null | undefined;
  completedAt: Date | null | undefined;
};

/**
 * Derives startedAt / completedAt from status changes and optional body fields.
 * When the client sends null for a date field but the status implies that date,
 * uses `now` instead of clearing (forms often send null for empty inputs).
 */
export function resolveLogStatusDates(input: ResolveLogStatusDatesInput): ResolveLogStatusDatesResult {
  const now = input.now ?? new Date();
  const status = input.status;
  const previousStatus = input.previousStatus ?? null;
  const statusChanged = input.statusProvided && status !== previousStatus;

  let startedAt: Date | null | undefined = undefined;
  let completedAt: Date | null | undefined = undefined;

  if (input.bodyStartedAt !== undefined) {
    if (input.bodyStartedAt == null) {
      startedAt =
        statusSetsStartedAt(status) && (input.existingStartedAt == null || statusChanged)
          ? now
          : null;
    } else {
      startedAt = parseManualLogDate(input.bodyStartedAt);
    }
  } else if (statusSetsStartedAt(status) && (input.existingStartedAt == null || statusChanged)) {
    startedAt = now;
  }

  if (input.bodyCompletedAt !== undefined) {
    if (input.bodyCompletedAt == null) {
      completedAt =
        statusSetsCompletedAt(status) && (input.existingCompletedAt == null || statusChanged)
          ? now
          : null;
    } else {
      completedAt = parseManualLogDate(input.bodyCompletedAt);
    }
  } else if (statusSetsCompletedAt(status) && (input.existingCompletedAt == null || statusChanged)) {
    completedAt = now;
  }

  return { startedAt, completedAt };
}
