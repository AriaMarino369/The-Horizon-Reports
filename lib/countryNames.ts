import countries from "world-countries";

// A plain, sorted list of real country names (no "server-only" import) —
// safe to import from a Client Component for a country <select>, unlike
// lib/worldCountries.ts which carries the full lookup/alias logic server-side.
export const COUNTRY_NAMES: string[] = countries
  .map((c) => c.name.common)
  .sort((a, b) => a.localeCompare(b));
