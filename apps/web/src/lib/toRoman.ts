/** Convert 1-based level to Roman numeral (I, II, III, … up to ~XII). */
export function toRoman(n: number): string {
  if (n < 1 || n > 12) return String(n);
  const map: Record<number, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
    9: "IX",
    10: "X",
    11: "XI",
    12: "XII",
  };
  return map[n] ?? String(n);
}
