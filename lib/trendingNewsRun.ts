import "server-only";
import { db } from "@/lib/db";
import { searchTrendingIncidents } from "@/lib/trendingNewsCandidates";
import { lookupCountry } from "@/lib/worldCountries";

// Keeps the map "current" per the spec: a pin reflects something that
// happened within roughly the last 24-hour refresh cycle, with headroom for
// the two runs a day not landing exactly 24h apart. Anything older is
// archived every run even if no replacement was found for that country —
// so a conflict that's gone quiet drops off the map within a day, rather
// than accumulating stale pins indefinitely.
const FRESHNESS_WINDOW_MS = 30 * 60 * 60 * 1000; // 30 hours

export async function runTrendingNewsRefresh() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - FRESHNESS_WINDOW_MS);

  const candidates = await searchTrendingIncidents();

  let created = 0;
  let skippedUnresolvedCountry = 0;

  for (const c of candidates) {
    const country = lookupCountry(c.country);
    if (!country) {
      // Never fabricate a pin location — if the country name doesn't match
      // a real, known country, skip it rather than guess coordinates.
      console.warn(`[trendingNewsRun] Could not resolve country "${c.country}" — skipping.`);
      skippedUnresolvedCountry++;
      continue;
    }

    try {
      await db.$transaction([
        // Archive any currently-published incident for this country first —
        // enforces "at most one active pin per country" (also backed by a
        // DB-level partial unique index as a belt-and-braces guard).
        db.trendingIncident.updateMany({
          where: { country: country.name, status: "PUBLISHED" },
          data: { status: "ARCHIVED" },
        }),
        db.trendingIncident.create({
          data: {
            country: country.name,
            countryCode: country.cca2,
            latitude: country.lat,
            longitude: country.lng,
            category: c.category,
            title: c.title,
            summary: c.summary,
            sourceName: c.sourceName,
            sourceUrl: c.sourceUrl,
            originalLanguage: c.originalLanguage,
            publishedAt: c.publishedAt,
            status: "PUBLISHED",
            createdBy: "bot",
          },
        }),
      ]);
      created++;
    } catch (e) {
      console.error(`[trendingNewsRun] Failed to apply incident for ${country.name}:`, e);
    }
  }

  // Auto-expire anything stale, including countries that weren't refreshed
  // in this run at all (e.g. a conflict that's gone quiet).
  const expired = await db.trendingIncident.updateMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { publishedAt: { lt: cutoff } },
        { publishedAt: null, createdAt: { lt: cutoff } },
      ],
    },
    data: { status: "ARCHIVED" },
  });

  const activeCount = await db.trendingIncident.count({ where: { status: "PUBLISHED" } });

  return {
    candidatesFound: candidates.length,
    created,
    skippedUnresolvedCountry,
    expired: expired.count,
    activeCount,
  };
}
