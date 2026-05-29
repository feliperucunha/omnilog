const STORAGE_KEY = "geeklogs.updatePromptDismissed.v1";

export function readDismissedUpdateVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

export function writeDismissedUpdateVersion(serverVersion: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, serverVersion.trim());
  } catch {
    /* quota / private mode */
  }
}
