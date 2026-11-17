import "server-only";
import { db } from "@/lib/db";
import { searchAircraftNewsCandidate } from "@/lib/aircraftNewsCandidates";

const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;
// Leaves headroom under the route's maxDuration for the in-flight search
// call plus DB writes to finish cleanly rather than being cut off mid-item.
const TIME_BUDGET_MS = 260 * 1000;

/**
 * Refreshes the single "Recent Events" article stored on each MilitaryAircraft.
 *
 * Runs weekly (see app/api/cron/aircraft-news-refresh/route.ts and
 * vercel.json), but each aircraft is only actually re-searched once its own
 * recentEventRefreshedAt is at least a fortnight old (or never set) — so the
 * effective per-aircraft cadence is fortnightly as specified, while staying
 * resilient to an occasional missed/slow run. Processes the most-overdue
 * aircraft first and stops within a time budget rather than a fixed count,
 * so a growing or shrinking aircraft roster doesn't need a matching code
 * change — on the first few runs after this feature ships, the backlog of
 * aircraft that have never been checked will be worked down a batch at a
 * time rather than all at once.
 *
 * A failed or empty search leaves the existing stored article untouched
 * (explicitly "retain that article" per spec) but still stamps
 * recentEventRefreshedAt, so a persistently newsless aircraft doesn't
 * monopolize every run by staying permanently "most overdue".
 */
export async function runAircraftNewsRefresh() {
  const started = Date.now();
  const cutoff = new Date(started - FORTNIGHT_MS);

  const due = await db.militaryAircraft.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ recentEventRefreshedAt: null }, { recentEventRefreshedAt: { lt: cutoff } }],
    },
    orderBy: [{ recentEventRefreshedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: { id: true, name: true, manufacturer: true },
  });

  const results: { name: string; outcome: "updated" | "retained" | "error" }[] = [];

  for (const aircraft of due) {
    if (Date.now() - started > TIME_BUDGET_MS) break;

    try {
      const candidate = await searchAircraftNewsCandidate(aircraft.name, aircraft.manufacturer);
      if (candidate) {
        await db.militaryAircraft.update({
          where: { id: aircraft.id },
          data: {
            recentEventTitle: candidate.title,
            recentEventUrl: candidate.url,
            recentEventSourceName: candidate.sourceName,
            recentEventSummary: candidate.summary,
            recentEventPublishedAt: candidate.publishedAt,
            recentEventRefreshedAt: new Date(),
          },
        });
        results.push({ name: aircraft.name, outcome: "updated" });
      } else {
        // Nothing new found — retain whatever is already stored, just stamp the check.
        await db.militaryAircraft.update({
          where: { id: aircraft.id },
          data: { recentEventRefreshedAt: new Date() },
        });
        results.push({ name: aircraft.name, outcome: "retained" });
      }
    } catch (e) {
      console.error(`aircraft-news-refresh failed for ${aircraft.name}:`, e);
      results.push({ name: aircraft.name, outcome: "error" });
    }
  }

  return {
    due: due.length,
    processed: results.length,
    updated: results.filter((r) => r.outcome === "updated").length,
    retained: results.filter((r) => r.outcome === "retained").length,
    errors: results.filter((r) => r.outcome === "error").length,
    remaining: due.length - results.length,
  };
}
