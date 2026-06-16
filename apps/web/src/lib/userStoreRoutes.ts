import { getPublicWebOrigin } from "@/lib/publicWebOrigin";

export function userStorePath(identifier: string): string {
  return `/${encodeURIComponent(identifier)}/store`;
}

export function userStoreShareUrl(identifier: string): string {
  const base = getPublicWebOrigin().replace(/\/$/, "");
  return `${base}${userStorePath(identifier)}`;
}
