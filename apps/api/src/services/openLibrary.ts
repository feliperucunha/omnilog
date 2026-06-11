import { decodeHtmlEntities, type SearchResult, type ItemDetail, SEARCH_RESULTS_PAGE_SIZE } from "@geeklogs/shared";
import { sortSearchResults } from "../lib/sortSearchResults.js";

const BASE = "https://openlibrary.org";

async function fetchOpenLibraryWorkPagesCount(workId: string): Promise<number | null> {
  try {
    const res = await fetch(`${BASE}/works/${workId}/editions.json?limit=20`, {
      headers: { "User-Agent": "Geeklogs/1.0 (https://github.com/geeklogs)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      entries?: Array<{ number_of_pages?: number }>;
    };
    const counts = (data.entries ?? [])
      .map((e) => e.number_of_pages)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
    if (counts.length === 0) return null;
    counts.sort((a, b) => a - b);
    const mid = Math.floor(counts.length / 2);
    return counts.length % 2 === 0 ? Math.round((counts[mid - 1]! + counts[mid]!) / 2) : counts[mid]!;
  } catch {
    return null;
  }
}

export async function getBookById(workId: string): Promise<ItemDetail | null> {
  const res = await fetch(`${BASE}/works/${workId}.json`, {
    headers: { "User-Agent": "Geeklogs/1.0 (https://github.com/geeklogs)" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    title?: string;
    first_publish_date?: string;
    covers?: number[];
    description?: string | { value?: string };
    authors?: Array<{ key?: string }>;
    subjects?: string[];
  };
  const year = data.first_publish_date?.slice(0, 4) ?? null;
  const image = data.covers?.[0]
    ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`
    : null;
  let description: string | null = null;
  if (typeof data.description === "string")
    description = data.description.trim().slice(0, 2000) || null;
  else if (data.description && typeof data.description === "object" && typeof data.description.value === "string")
    description = data.description.value.trim().slice(0, 2000) || null;
  if (description) description = decodeHtmlEntities(description);
  let authors: string[] | null = null;
  if (Array.isArray(data.authors) && data.authors.length > 0) {
    const authorKeys = data.authors.slice(0, 3).map((a) => a.key).filter(Boolean) as string[];
    if (authorKeys.length > 0) {
      const names = await Promise.all(
        authorKeys.map(async (key) => {
          const authRes = await fetch(`${BASE}${key}.json`, {
            headers: { "User-Agent": "Geeklogs/1.0 (https://github.com/geeklogs)" },
          });
          if (!authRes.ok) return null;
          const auth = (await authRes.json()) as { name?: string };
          const nm = auth.name ?? null;
          return nm != null ? decodeHtmlEntities(nm) : null;
        })
      );
      authors = names.filter((n): n is string => n != null);
    }
  }
  const subjects = Array.isArray(data.subjects)
    ? data.subjects
        .filter((s): s is string => typeof s === "string")
        .slice(0, 15)
        .map((s) => decodeHtmlEntities(s))
    : [];
  const genres = subjects.length > 0 ? subjects : null;
  const title = decodeHtmlEntities(data.title ?? "Unknown");
  const pagesCount = await fetchOpenLibraryWorkPagesCount(workId);
  return {
    id: workId,
    title,
    image,
    year,
    subtitle: authors?.length ? authors.join(", ") : null,
    description: description ?? null,
    authors: authors?.length ? authors : null,
    subjects: subjects.length > 0 ? subjects : null,
    genres,
    pagesCount,
  };
}

/** When set, Open Library server-side sort + fields for `ratings_average` (used for recommendation ordering). */
export type OpenLibrarySearchOptions = {
  openLibraryApiSort?: "rating" | "rating_count";
};

const OL_FIELDS_BASE =
  "key,title,first_publish_year,cover_i,author_name,number_of_pages_median";
const OL_FIELDS_WITH_RATING = `${OL_FIELDS_BASE},ratings_average`;

export async function searchBooks(
  q: string,
  sort?: string,
  options?: OpenLibrarySearchOptions
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q, limit: String(SEARCH_RESULTS_PAGE_SIZE) });
  if (options?.openLibraryApiSort) {
    params.set("sort", options.openLibraryApiSort);
    params.set("fields", OL_FIELDS_WITH_RATING);
  } else {
    params.set("fields", OL_FIELDS_BASE);
  }
  const res = await fetch(`${BASE}/search.json?${params.toString()}`, {
    headers: { "User-Agent": "Geeklogs/1.0 (https://github.com/geeklogs)" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    docs?: Array<{
      key: string;
      title?: string;
      first_publish_year?: number;
      cover_i?: number;
      author_name?: string[];
      ratings_average?: number;
      number_of_pages_median?: number;
    }>;
  };
  const docs = data.docs ?? [];
  let results = docs.map((doc) => {
    const pagesMedian = doc.number_of_pages_median;
    const pagesCount =
      typeof pagesMedian === "number" && Number.isFinite(pagesMedian) && pagesMedian > 0
        ? Math.round(pagesMedian)
        : null;
    return {
      id: doc.key.replace(/^\/works\//, ""),
      title: decodeHtmlEntities(doc.title ?? "Unknown"),
      image: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
        : null,
      year: doc.first_publish_year != null ? String(doc.first_publish_year) : null,
      subtitle: Array.isArray(doc.author_name)
        ? doc.author_name.map((a) => decodeHtmlEntities(a)).join(", ")
        : null,
      score:
        typeof doc.ratings_average === "number" && doc.ratings_average > 0 ? doc.ratings_average : null,
      pagesCount,
    };
  });
  return sortSearchResults(results, sort);
}
