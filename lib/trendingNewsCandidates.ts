import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-sonnet-5";

const CATEGORIES = ["AIRSTRIKE", "UAV_DRONE", "AIR_DEFENSE", "AIRCRAFT_LOSS", "NON_KINETIC", "OTHER"] as const;

const IncidentSchema = z.object({
  country: z
    .string()
    .describe("The real-world country name in English where the incident occurred (not the nationality of the actor) — e.g. 'Ukraine', 'Lebanon', 'Yemen'."),
  category: z.enum(CATEGORIES).describe(
    "AIRSTRIKE = a kinetic air-delivered strike; UAV_DRONE = a drone/UAV strike, intercept, or notable UAV operation; AIR_DEFENSE = an air-defence engagement (SAM launch, intercept, etc.); AIRCRAFT_LOSS = an aircraft shot down, crashed, or destroyed on the ground; NON_KINETIC = electronic warfare, jamming, cyberattack on air/military systems, or airspace violation without a strike; OTHER = genuinely air-power/military-aviation-relevant but doesn't fit the above."
  ),
  title: z.string().describe("The article's actual headline, or a faithful short English title if translated."),
  summary: z
    .string()
    .describe("2-4 sentence plain-English summary of the incident, written in English regardless of the source article's language."),
  sourceName: z.string().describe("The outlet's name, e.g. 'Reuters' or 'The War Zone'."),
  sourceUrl: z.string().describe("Direct URL to the article exactly as returned by search."),
  publishedDate: z
    .string()
    .nullable()
    .describe("The article's own publish date in YYYY-MM-DD, exactly as reported — null if genuinely undated."),
  originalLanguage: z
    .string()
    .nullable()
    .describe("ISO 639-1 code of the source article's original language if it was not English (e.g. 'ar', 'ru', 'uk', 'he'), else null."),
});

const TrendingIncidentsSchema = z.object({
  incidents: z
    .array(IncidentSchema)
    .max(25)
    .describe("Distinct current incidents, at most one per country, most significant/recent first."),
});

export type TrendingIncidentCandidate = {
  country: string;
  category: (typeof CATEGORIES)[number];
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: Date | null;
  originalLanguage: string | null;
};

/**
 * Searches worldwide for CURRENT, air-power-relevant conflict incidents —
 * for the Trending News heat map. Uses Claude's own hosted web-search tool
 * (same pattern as lib/aircraftNewsCandidates.ts / lib/webSearchCandidates.ts)
 * so this runs server-side in a cron job with no separate search API.
 * Returns at most one candidate per country (the caller still de-dupes
 * defensively) and never invents a result — a story that can't be verified
 * via search is simply left out.
 */
export async function searchTrendingIncidents(): Promise<TrendingIncidentCandidate[]> {
  const client = new Anthropic();

  const now = new Date();
  const windowEnd = now.toISOString().slice(0, 10);
  const windowStart = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const system = `You are a research assistant for "The Horizon Reports", an open-source military intelligence briefing. Use web search to find CURRENT, real-world conflict incidents worldwide that specifically involve military AIR POWER — air forces, military aircraft (crewed or unmanned), air-strikes, or non-kinetic air/electronic-warfare actions.

Only report incidents that fall into one of these categories:
- an air-delivered strike (fixed-wing, rotary, or stand-off munition)
- a drone/UAV strike, intercept, or other notable unmanned-platform action
- an air-defence engagement (surface-to-air missile launch, intercept, etc.)
- a military aircraft shot down, crashed, or destroyed
- a non-kinetic action affecting air/military systems (electronic warfare, jamming, a cyberattack on air-defence or aviation infrastructure, or a significant unauthorized airspace incursion)

Rules:
- Search broadly across active conflict zones and flashpoints worldwide — do not limit yourself to one region. Cover as many DISTINCT countries as you can find genuine, current incidents for, up to 25.
- Report AT MOST ONE incident per country — the single most significant or most recent qualifying incident for that country.
- Only report incidents first published between ${windowStart} and ${windowEnd} (the last 48 hours). Do not report older incidents even if they're otherwise notable.
- Prefer reputable, established outlets (Reuters, AP, AFP, BBC, Jane's, Defense News, The War Zone, Al Jazeera, national/international wire services, or a government/military's own official statement) over unverified social media, rumor, or single-blog claims. If you cannot corroborate a claim against a reputable source, leave it out.
- If the best available source for a genuine incident is in a language other than English, that's fine — read it, verify it's real, and write the title/summary in your own faithful English translation. Set originalLanguage to that language's ISO 639-1 code (e.g. "ar", "ru", "uk", "he", "fa"). If the source is already in English, leave originalLanguage null.
- The result MUST be a real article/incident you found via search — never invent a country, title, outlet, URL, date, or detail. If you cannot find enough genuinely current, verifiable incidents, return fewer entries (even zero) rather than padding the list with weak or stale matches.
- Use the country's real-world common English name (e.g. "Ukraine", "Lebanon", "Myanmar") — the country where the incident physically occurred, not the nationality of whichever side carried it out.
- Report the article's own publish date (from its byline/dateline) as YYYY-MM-DD — never invent one; use null if genuinely undated.`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 12 }],
    output_config: { effort: "medium", format: zodOutputFormat(TrendingIncidentsSchema) },
    system,
    messages: [
      {
        role: "user",
        content: `Search for current (last 48 hours), verifiable, air-power-relevant conflict incidents worldwide and return the structured result — at most one per country, up to 25 distinct countries.`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) return [];

  const seenCountries = new Set<string>();
  const results: TrendingIncidentCandidate[] = [];

  for (const inc of parsed.incidents) {
    if (!inc.country || !inc.title || !inc.summary || !inc.sourceName || !inc.sourceUrl) continue;
    const countryKey = inc.country.trim().toLowerCase();
    if (seenCountries.has(countryKey)) continue; // defensive de-dupe even though the prompt asks for one per country

    try {
      new URL(inc.sourceUrl);
    } catch {
      continue;
    }

    const publishedAt = inc.publishedDate ? new Date(inc.publishedDate) : null;

    seenCountries.add(countryKey);
    results.push({
      country: inc.country.trim(),
      category: inc.category,
      title: inc.title,
      summary: inc.summary,
      sourceName: inc.sourceName,
      sourceUrl: inc.sourceUrl,
      publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
      originalLanguage: inc.originalLanguage,
    });
  }

  return results;
}
