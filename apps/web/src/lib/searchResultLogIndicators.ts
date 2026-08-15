import type { Log } from "@geeklogs/shared";
import { logStatusBadgeClass, logStatusRailClass } from "@/lib/logStatusColors";

export type SearchLogStatusSource = Pick<Log, "status" | "listType">;

/** Status styling for search cards when the item is already in the user's list. */
export function searchResultLogIndicators(userLog: SearchLogStatusSource | undefined): {
  inList: boolean;
  status: string | null;
  railClass: string;
  badgeClass: string;
} {
  if (!userLog) {
    return {
      inList: false,
      status: null,
      railClass: logStatusRailClass(null),
      badgeClass: "",
    };
  }
  const status = userLog.status ?? userLog.listType ?? null;
  return {
    inList: true,
    status,
    railClass: logStatusRailClass(status),
    badgeClass: logStatusBadgeClass(status),
  };
}
