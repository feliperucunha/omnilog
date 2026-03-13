/**
 * Returns a higher-resolution image URL for hero/header use when the source
 * is a known CDN that supports size parameters. Improves quality for item detail hero.
 */
export function getHeroImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "") return null;
  const url = imageUrl.trim();

  // TMDB: poster sizes w92, w154, w185, w342, w500, w780, original
  if (url.includes("image.tmdb.org/t/p/")) {
    return url.replace(/\/t\/p\/w\d+\//, "/t/p/w780/");
  }

  // Open Library: -S (small), -M (medium), -L (large). Use L for hero.
  if (url.includes("covers.openlibrary.org") && url.endsWith("-M.jpg")) {
    return url.replace(/-M\.jpg$/i, "-L.jpg");
  }

  return url;
}
