/** Color palette for genre badges: solid backgrounds + white text for readability. Same genre name => same color. */
const GENRE_COLORS = [
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-blue-600 text-white",
  "bg-purple-600 text-white",
  "bg-rose-600 text-white",
  "bg-cyan-600 text-white",
  "bg-indigo-600 text-white",
  "bg-orange-600 text-white",
  "bg-teal-600 text-white",
  "bg-pink-600 text-white",
] as const;

function getGenreColorClass(genre: string): string {
  let h = 0;
  const s = genre.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % GENRE_COLORS.length;
  return GENRE_COLORS[idx];
}

/** Renders genre badges with deterministic color coding. Use maxCount=1 for tight layouts (search, lists). */
export function GenreBadges({
  genres,
  maxCount = 2,
  className,
}: {
  genres: string[] | null | undefined;
  /** Max badges to show (default 2). Use 1 for search/list cards. */
  maxCount?: number;
  /** Optional extra class on the wrapper. */
  className?: string;
}) {
  if (!genres || genres.length === 0) return null;
  const show = genres.slice(0, maxCount);
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {show.map((g) => (
        <span
          key={g}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getGenreColorClass(g)}`}
        >
          {g}
        </span>
      ))}
    </span>
  );
}
