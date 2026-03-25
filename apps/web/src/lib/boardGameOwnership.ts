/** UI + API mapping: `own` / `wantToBuy` booleans on Log. */
export type BoardGameOwnership = "doNotOwn" | "wantToBuy" | "own";

export const boardGameOwnershipFromBooleans = (
  own: boolean | null | undefined,
  wantToBuy: boolean | null | undefined
): BoardGameOwnership => {
  if (own === true) return "own";
  if (wantToBuy === true) return "wantToBuy";
  return "doNotOwn";
};

export const boardGameOwnershipToBooleans = (
  mode: BoardGameOwnership
): { own: boolean; wantToBuy: boolean } => {
  switch (mode) {
    case "own":
      return { own: true, wantToBuy: false };
    case "wantToBuy":
      return { own: false, wantToBuy: true };
    default:
      return { own: false, wantToBuy: false };
  }
};
