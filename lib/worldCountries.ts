import "server-only";
import countries from "world-countries";

export type WorldCountry = {
  name: string; // canonical common name, e.g. "Singapore"
  cca2: string; // ISO 3166-1 alpha-2, e.g. "SG"
  lat: number;
  lng: number;
  flag: string; // emoji, e.g. "🇸🇬"
};

const BY_NAME = new Map<string, WorldCountry>();

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

for (const c of countries) {
  const entry: WorldCountry = {
    name: c.name.common,
    cca2: c.cca2,
    lat: c.latlng[0],
    lng: c.latlng[1],
    flag: c.flag,
  };
  BY_NAME.set(normalize(c.name.common), entry);
  BY_NAME.set(normalize(c.name.official), entry);
  for (const alt of c.altSpellings ?? []) {
    // Skip short codes as alt-spelling keys (e.g. "US", "UK") — too prone to
    // colliding with unrelated short strings a model might return.
    if (alt.length > 3) BY_NAME.set(normalize(alt), entry);
  }
}

// A handful of common names/aliases that news coverage uses but don't
// exactly match world-countries' common/official/altSpellings — mapped by
// hand rather than guessed at runtime, so a lookup either matches a real,
// verified country or returns null (never a fabricated close-enough pin).
const EXTRA_ALIASES: Record<string, string> = {
  "russia": "Russia",
  "south korea": "South Korea",
  "north korea": "North Korea",
  "myanmar": "Myanmar",
  "burma": "Myanmar",
  "taiwan": "Taiwan",
  "palestine": "Palestine",
  "gaza": "Palestine",
  "west bank": "Palestine",
  "ivory coast": "Ivory Coast",
  "czech republic": "Czechia",
  "uae": "United Arab Emirates",
  "u.a.e.": "United Arab Emirates",
  "usa": "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "america": "United States",
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "britain": "United Kingdom",
  "great britain": "United Kingdom",
  "drc": "DR Congo",
  "democratic republic of congo": "DR Congo",
  "democratic republic of the congo": "DR Congo",
  "republic of congo": "Republic of the Congo",
  "laos": "Laos",
  "vietnam": "Vietnam",
  "viet nam": "Vietnam",
};
for (const [alias, canonical] of Object.entries(EXTRA_ALIASES)) {
  const target = BY_NAME.get(normalize(canonical));
  if (target) BY_NAME.set(normalize(alias), target);
}

/**
 * Resolves a country name (as freely written by a news article or an AI
 * search result) to a canonical, verified country record with a real
 * lat/lng centroid and flag emoji — or null if it doesn't match any real
 * country in the world-countries dataset. Never guesses coordinates.
 */
export function lookupCountry(name: string): WorldCountry | null {
  return BY_NAME.get(normalize(name)) ?? null;
}
