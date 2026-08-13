import { COMPLETED_STATUSES, IN_PROGRESS_STATUSES } from "./types.js";

/** Statuses that set the finished/completed date (includes dropped). */
export const FINISHED_STATUSES = [...COMPLETED_STATUSES, "dropped"] as const;

export function statusSetsStartedAt(status: string | null | undefined): boolean {
  return status != null && (IN_PROGRESS_STATUSES as readonly string[]).includes(status);
}

export function statusSetsCompletedAt(status: string | null | undefined): boolean {
  return status != null && (FINISHED_STATUSES as readonly string[]).includes(status);
}
