import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-sonnet-5";

const RecentEventSchema = z.object({
  found: z.boolean().describe("True only if a genuine, verifiable, reasonably current article was found via search."),
  title: z.string().nullable().describe("The article's actual headline, or null if found=false."),
  url: z.string().nullable().describe("Direct URL to the article exactly as returned by search, or null if found=false."),
  sourceName: z.string().nullable().describe("The outlet's name, e.g. 'Reuters' or 'The War Zone', or null."),
  summary: z.string().nullable().describe("One-sentence summary of what the article reports, or null."),
  publishedDate: z
    .string()
    .nullable()
    .describe("The article's own publish date in YYYY-MM-DD, exactly as reported by the source — null if undated or found=false."),
});

export type AircraftNewsCandidate = {
  title: string;
  url: string;
  sourceName: string;
  summary: string;
  publishedAt: Date | null;
};

/**
 * Searches for ONE current, reliable news story about a specific aircraft
 * type, for the "Recent Events" section on its platform page. Scoped to:
 * improvements/upgrades, damage, shoot-downs, crashes, and new variants —
 * not general/unrelated coverage. Uses Claude's own hosted web-search tool
 * (same billing/pattern as lib/webSearchCandidates.ts) so this runs
 * server-side in a cron job without a separate search API/credential.
 * Returns null rather than inventing a result when nothing qualifies.
 */
export async function searchAircraftNewsCandidate(
  aircraftName: string,
  manufacturer: string
): Promise<AircraftNewsCandidate | null> {
  const client = new Anthropic();

  const windowEnd = new Date().toISOString().slice(0, 10);
  const windowStart = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const system = `You are a research assistant for "FIGHTER GROUP INTEL / NEWS UPDATE", an open-source military intelligence briefing. Use web search to find ONE current, reliable news story specifically about the "${aircraftName}" (manufacturer: ${manufacturer}) military aircraft type.

Only report a story that falls into one of these categories:
- aircraft or systems improvements/upgrades for this type
- an example of this type being damaged, shot down, or crashed
- a new variant or new customer/operator being announced for this type

Rules:
- The story MUST genuinely be about this specific aircraft TYPE — not a different, similarly-named, or visually similar type. If you are not confident the story is about this exact type, do not report it.
- Prefer stories first published between ${windowStart} and ${windowEnd}, and prefer the MOST RECENT qualifying story you can find.
- Prefer reputable, established outlets (Reuters, AP, BBC, Jane's, Defense News, The War Zone, Naval News, Breaking Defense, national broadsheets) over unverified blogs or aggregators.
- The result MUST be a real article you found via search — never invent a title, outlet, URL, or date.
- If you cannot find a genuine, verifiable, reasonably current story matching the categories above, set found=false and leave the other fields null. Do not substitute an old, unrelated, or low-confidence story just to have something to report.
- Report the article's own publish date (from its byline/dateline) as YYYY-MM-DD — never invent one; use null if genuinely undated.`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
    output_config: { effort: "medium", format: zodOutputFormat(RecentEventSchema) },
    system,
    messages: [
      {
        role: "user",
        content: `Search for a current, reliable news story about the ${aircraftName} matching one of the listed categories, and return the structured result.`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed || !parsed.found || !parsed.title || !parsed.url || !parsed.sourceName || !parsed.summary) {
    return null;
  }

  try {
    new URL(parsed.url);
  } catch {
    return null;
  }

  const publishedAt = parsed.publishedDate ? new Date(parsed.publishedDate) : null;

  return {
    title: parsed.title,
    url: parsed.url,
    sourceName: parsed.sourceName,
    summary: parsed.summary,
    publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
  };
}
