import type { SearchResult, ItemDetail } from "@logeverything/shared";
import { sortSearchResults } from "../lib/sortSearchResults.js";

const BASE = "https://openlibrary.org";

export async function getBookById(workId: string): Promise<ItemDetail | null> {
  const res = await fetch(`${BASE}/works/${workId}.json`, {
    headers: { "User-Agent": "Logeverything/1.0 (https://github.com/logeverything)" },
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
  if (typeof data.description === "string") description = data.description.trim().slice(0, 2000) || null;
  else if (data.description && typeof data.description === "object" && typeof data.description.value === "string")
    description = data.description.value.trim().slice(0, 2000) || null;
  let authors: string[] | null = null;
  if (Array.isArray(data.authors) && data.authors.length > 0) {
    const authorKeys = data.authors.slice(0, 3).map((a) => a.key).filter(Boolean) as string[];
    if (authorKeys.length > 0) {
      const names = await Promise.all(
        authorKeys.map(async (key) => {
          const authRes = await fetch(`${BASE}${key}.json`, {
            headers: { "User-Agent": "Logeverything/1.0 (https://github.com/logeverything)" },
          });
          if (!authRes.ok) return null;
          const auth = (await authRes.json()) as { name?: string };
          return auth.name ?? null;
        })
      );
      authors = names.filter((n): n is string => n != null);
    }
  }
  const subjects = Array.isArray(data.subjects) ? data.subjects.filter((s): s is string => typeof s === "string").slice(0, 15) : [];
  return {
    id: workId,
    title: data.title ?? "Unknown",
    image,
    year,
    subtitle: authors?.length ? authors.join(", ") : null,
    description: description ?? null,
    authors: authors?.length ? authors : null,
    subjects: subjects.length > 0 ? subjects : null,
  };
}

export async function searchBooks(q: string, sort?: string): Promise<SearchResult[]> {
  const res = await fetch(
    `${BASE}/search.json?q=${encodeURIComponent(q)}&limit=20`,
    { headers: { "User-Agent": "Logeverything/1.0 (https://github.com/logeverything)" } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    docs?: Array<{
      key: string;
      title?: string;
      first_publish_year?: number;
      cover_i?: number;
      author_name?: string[];
    }>;
  };
  const docs = data.docs ?? [];
  let results = docs.map((doc) => ({
    id: doc.key.replace(/^\/works\//, ""),
    title: doc.title ?? "Unknown",
    image: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : null,
    year: doc.first_publish_year != null ? String(doc.first_publish_year) : null,
    subtitle: Array.isArray(doc.author_name) ? doc.author_name.join(", ") : null,
  }));
  return sortSearchResults(results, sort);
}
