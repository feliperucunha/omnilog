export function formatBoardGameWeight(weight: number | null | undefined): string | null {
  if (weight == null || !Number.isFinite(weight) || weight <= 0) return null;
  const rounded = Math.round(weight * 10) / 10;
  return `${rounded}/5`;
}

export function boardGameWeightDisplay(weight: number | null | undefined): string | null {
  return formatBoardGameWeight(weight);
}
