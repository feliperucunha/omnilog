import type { SearchResult, ItemDetail } from "@logeverything/shared";

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
  };
  const year = data.first_publish_date?.slice(0, 4) ?? null;
  const image = data.covers?.[0]
    ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg`
    : null;
  return {
    id: workId,
    title: data.title ?? "Unknown",
    image,
    year,
    subtitle: null,
  };
}

export async function searchBooks(q: string): Promise<SearchResult[]> {
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
  return docs.map((doc) => ({
    id: doc.key.replace(/^\/works\//, ""),
    title: doc.title ?? "Unknown",
    image: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : null,
    year: doc.first_publish_year != null ? String(doc.first_publish_year) : null,
    subtitle: Array.isArray(doc.author_name) ? doc.author_name.join(", ") : null,
  }));
}
