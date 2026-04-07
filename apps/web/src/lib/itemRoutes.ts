/**
 * Path for `Route path="item/:mediaType/:id"` — encodes segments so `/`, `?`, `#`, etc.
 * in `externalId` do not break matching or navigation.
 */
export function itemDetailPath(mediaType: string, externalId: string): string {
  return `/item/${encodeURIComponent(mediaType)}/${encodeURIComponent(externalId)}`;
}
