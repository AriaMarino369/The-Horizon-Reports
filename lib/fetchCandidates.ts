import "server-only";
import Parser from "rss-parser";
import { SOURCES, RELEVANCE_KEYWORDS } from "@/lib/sources";
import type { Region } from "@/generated/prisma/client";

export type Candidate = {
  title: string;
  link: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt?: Date;
  contentSnippet?: string;
};

const parser = new Parser({ timeout: 10_000 });

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return RELEVANCE_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}

/** Best-effort RSS discovery: try the source URL itself, then common /feed paths. */
async function tryFeedUrls(baseUrl: string): Promise<string[]> {
  const url = new URL(baseUrl);
  const origin = `${url.protocol}//${url.host}`;
  return [baseUrl, `${baseUrl.replace(/\/$/, "")}/feed`, `${origin}/feed`, `${origin}/rss`];
}

async function fetchOneSource(
  name: string,
  sourceUrl: string,
  cutoff: Date,
  anchorDate: Date
): Promise<Candidate[]> {
  const candidateFeedUrls = await tryFeedUrls(sourceUrl);
  for (const feedUrl of candidateFeedUrls) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = (feed.items ?? [])
        .filter((item) => item.title && item.link)
        .map((item) => ({
          title: item.title!.trim(),
          link: item.link!,
          sourceName: name,
          sourceUrl,
          publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
          contentSnippet: item.contentSnippet?.slice(0, 500),
        }))
        .filter((c) => !c.publishedAt || (c.publishedAt >= cutoff && c.publishedAt <= anchorDate))
        .filter((c) => isRelevant(`${c.title} ${c.contentSnippet ?? ""}`));
      if (items.length > 0) return items;
    } catch {
      // try next candidate feed URL / source
    }
  }
  return [];
}

/**
 * Best-effort fetch of recent, relevance-filtered headlines for a region's
 * curated sources. Not every source exposes RSS — those simply return no
 * candidates rather than failing the whole run. `cutoffDays` is measured
 * back from `anchorDate` (the article's own publishing Monday — `weekOf` —
 * not wall-clock "now"), so a backdated regeneration windows correctly
 * around its own week rather than the moment the admin happens to click.
 */
export async function fetchCandidatesForRegion(
  region: Region,
  options: { cutoffDays?: number; anchorDate?: Date; countryFilter?: string } = {}
): Promise<Candidate[]> {
  const { cutoffDays = 35, anchorDate = new Date(), countryFilter } = options;
  const cutoff = new Date(anchorDate.getTime() - cutoffDays * 24 * 60 * 60 * 1000);
  const sources = SOURCES[region];
  const results = await Promise.allSettled(
    sources.map((s) => fetchOneSource(s.name, s.url, cutoff, anchorDate))
  );
  const candidates = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!countryFilter) return candidates;
  const needle = countryFilter.toLowerCase();
  return candidates.filter(
    (c) => c.title.toLowerCase().includes(needle) || (c.contentSnippet ?? "").toLowerCase().includes(needle)
  );
}
