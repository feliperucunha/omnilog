import { Router } from "express";
import { z } from "zod";
import { upstreamFetch } from "../lib/upstreamFetch.js";
import type { CitySuggestion } from "@geeklogs/shared";

export const geocodeRouter = Router();

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = process.env.GEOCODE_USER_AGENT ?? "Geeklogs/1.0 (market city search)";

const citiesQuerySchema = z.object({
  q: z.string().min(2).max(128).trim(),
});

type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
};

function placeToSuggestion(place: NominatimPlace): CitySuggestion | null {
  const addr = place.address;
  if (!addr) return null;
  const city =
    addr.city?.trim() ||
    addr.town?.trim() ||
    addr.village?.trim() ||
    addr.municipality?.trim();
  if (!city) return null;
  const state = addr.state?.trim();
  const country = addr.country?.trim() ?? null;
  const countryCode = addr.country_code?.trim().toUpperCase() ?? null;
  const labelParts = [city, state, country].filter(Boolean);
  return {
    id: String(place.place_id),
    label: labelParts.join(", "),
    city,
    country,
    countryCode,
  };
}

geocodeRouter.get("/cities", async (req, res) => {
  const parsed = citiesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const q = parsed.data.q;
  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "8");
  url.searchParams.set("featuretype", "city");

  try {
    const response = await upstreamFetch(url.toString(), {
      provider: "default",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      retry: false,
    });
    if (!response.ok) {
      res.status(502).json({ error: "City search unavailable" });
      return;
    }
    const raw = (await response.json()) as NominatimPlace[];
    const seen = new Set<string>();
    const data: CitySuggestion[] = [];
    for (const place of raw) {
      const suggestion = placeToSuggestion(place);
      if (!suggestion) continue;
      const key = suggestion.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      data.push(suggestion);
    }
    res.json({ data });
  } catch {
    res.status(502).json({ error: "City search unavailable" });
  }
});
