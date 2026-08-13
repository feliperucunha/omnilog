import { statusSetsCompletedAt, statusSetsStartedAt } from "@geeklogs/shared";

export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateInputToIso(yyyyMmDd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt.toISOString();
}

export function todayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fill start/finish date inputs when the user picks a status that implies them. */
export function applyStatusAutoDates(
  status: string | null,
  previousStatus: string | null,
  setStartedAt: (v: string) => void,
  setCompletedAt: (v: string) => void
): void {
  const today = todayDateInput();
  if (status !== previousStatus && status != null) {
    if (statusSetsStartedAt(status)) setStartedAt(today);
    if (statusSetsCompletedAt(status)) setCompletedAt(today);
  }
}

/** Books: clear pages on any non-read status; set to edition max only when marked read. */
export function applyBookStatusPagesChange(
  nextStatus: string | null,
  setPagesRead: (value: number | "") => void,
  pagesCount: number | null | undefined
): void {
  if (nextStatus === "read") {
    if (pagesCount != null && pagesCount > 0) {
      setPagesRead(pagesCount);
    }
    return;
  }
  if (nextStatus != null) {
    setPagesRead("");
  }
}
