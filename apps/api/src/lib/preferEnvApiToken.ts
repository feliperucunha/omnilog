/** Prefer server env token so a bad user key in Settings does not break provider calls. */
export function preferEnvApiToken(
  envVal: string | undefined,
  userVal: string | null | undefined
): string | null {
  const e = envVal?.trim();
  if (e) return e;
  const u = userVal?.trim();
  if (u) return u;
  return null;
}
