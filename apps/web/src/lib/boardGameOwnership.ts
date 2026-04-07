/** UI + API mapping: `own` / `wantToBuy` / `sold` booleans on Log (spend-tracked categories). */
export type BoardGameOwnership = "doNotOwn" | "wantToBuy" | "own" | "sold";

export const boardGameOwnershipFromBooleans = (
  own: boolean | null | undefined,
  wantToBuy: boolean | null | undefined,
  sold?: boolean | null | undefined
): BoardGameOwnership => {
  if (sold === true) return "sold";
  if (own === true) return "own";
  if (wantToBuy === true) return "wantToBuy";
  return "doNotOwn";
};

export const boardGameOwnershipToBooleans = (
  mode: BoardGameOwnership
): { own: boolean; wantToBuy: boolean; sold: boolean } => {
  switch (mode) {
    case "own":
      return { own: true, wantToBuy: false, sold: false };
    case "wantToBuy":
      return { own: false, wantToBuy: true, sold: false };
    case "sold":
      return { own: false, wantToBuy: false, sold: true };
    default:
      return { own: false, wantToBuy: false, sold: false };
  }
};
