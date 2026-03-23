/**
 * Stored on `Log.affinityContext` (JSON) to power recommendations without extra catalog API calls per item.
 * Filled from item detail when the user saves/updates a log.
 */
export interface LogAffinityContext {
  boardgames?: {
    playingTimeMinutes?: number | null;
    playersMin?: number | null;
    playersMax?: number | null;
    minAge?: number | null;
    /** BGG average weight (complexity), typically ~1–5. */
    averageWeight?: number | null;
  };
  books?: {
    subjects?: string[];
    authors?: string[];
    publisher?: string | null;
    year?: number | null;
  };
  manga?: {
    genres?: string[];
    themes?: string[];
    demographics?: string[];
    serialization?: string | null;
  };
}
