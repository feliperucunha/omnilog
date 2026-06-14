export function countryLabel(code: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase());
    return name ?? code;
  } catch {
    return code;
  }
}
