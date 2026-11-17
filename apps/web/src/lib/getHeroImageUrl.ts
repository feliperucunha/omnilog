/** Normalizes API image fields (e.g. BGG XML `{ "#text": "url" }`) to a string for <img> / CSS url(). */
export function coerceImageUrlString(imageUrl: unknown): string | null {
  if (imageUrl == null) return null;
  if (typeof imageUrl === "string") {
    const s = imageUrl.trim();
    return s || null;
  }
  if (typeof imageUrl === "object" && imageUrl !== null && "#text" in imageUrl) {
    const t = (imageUrl as { "#text"?: unknown })["#text"];
    if (typeof t === "string") {
      const s = t.trim();
      return s || null;
    }
  }
  return null;
}

/** Prefer primary poster; use thumbnail when missing (e.g. BGG full image vs thumb). */
export function getItemDisplayImageUrl(
  image: string | null | undefined,
  thumbnail: string | null | undefined
): string | null {
  return getHeroImageUrl(image) ?? getHeroImageUrl(thumbnail);
}

/**
 * Header background: the catalog's wide cover when it has one, otherwise the search-card image.
 * `dropCover` is set after that cover URL fails to load.
 */
export function getItemHeaderImageUrl(
  cover: string | null | undefined,
  image: string | null | undefined,
  thumbnail: string | null | undefined,
  dropCover = false
): string | null {
  if (!dropCover) {
    const coverUrl = getHeroImageUrl(cover);
    if (coverUrl) return coverUrl;
  }
  return getItemDisplayImageUrl(image, thumbnail);
}

/**
 * Safe `background-image` value for React `style`. Unquoted `url(https://…)` is invalid CSS when
 * the URL contains `)` — e.g. BGG CDN paths like `filters:format(jpeg)/…` — so the rule is dropped.
 */
export function cssBackgroundImageUrl(url: string): string {
  const escaped = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

/**
 * Returns a higher-resolution image URL for hero/header use when the source
 * is a known CDN that supports size parameters. Improves quality for item detail hero.
 */
export function getHeroImageUrl(imageUrl: string | null | undefined): string | null {
  const url = coerceImageUrlString(imageUrl);
  if (!url) return null;

  // TMDB poster sizes. Leave w780, w1280, and original alone so wide covers are not shrunk.
  if (url.includes("image.tmdb.org/t/p/")) {
    return url.replace(/\/t\/p\/w(?:92|154|185|200|342|500)\//, "/t/p/w780/");
  }

  // Open Library: -S (small), -M (medium), -L (large). Use L for hero.
  if (url.includes("covers.openlibrary.org") && url.endsWith("-M.jpg")) {
    return url.replace(/-M\.jpg$/i, "-L.jpg");
  }

  return url;
}
