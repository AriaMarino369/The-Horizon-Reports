import "server-only";
import { db } from "@/lib/db";
import { getMonth, getYear } from "date-fns";
import type { Region } from "@/generated/prisma/client";
import { fetchCandidatesForRegion } from "@/lib/fetchCandidates";
import { searchWebCandidates } from "@/lib/webSearchCandidates";
import { crossCheck } from "@/lib/crossCheck";
import { findCorroboratingSources } from "@/lib/findCorroboration";
import { selectFreshCandidate } from "@/lib/dedupeCandidate";
import { generateArticleDraft } from "@/lib/generateArticle";
import { mondayOf } from "@/lib/weeks";
import { publishArticle } from "@/lib/publish";
import { CORE_REGIONS, OPTIONAL_REGIONS, REGION_LABELS } from "@/lib/sources";
import { notifyWeeklyPublished } from "@/lib/telegramNotify";

export class NoCandidatesError extends Error {
  constructor(region: string, topic?: string) {
    super(
      topic
        ? `No reliable recent story found for "${topic}" in ${region}. Try a different phrasing or check back later.`
        : `No relevant, dated candidates found for ${region}. Try again later or widen the cutoff.`
    );
  }
}

export class AllCandidatesDuplicateError extends Error {
  constructor(region: string, topic?: string) {
    super(
      topic
        ? `Every story found for "${topic}" in ${region} was already covered in a previous week or the archive. Try again once a new development is reported.`
        : `Every recent candidate story for ${region} was already covered in a previous week or the archive. Try again later once new coverage appears.`
    );
  }
}

/**
 * Fetches candidates for a region (optionally filtered to a specific
 * country), cross-checks the best one for corroboration, and generates a
 * DRAFT article via the Claude API. Does not publish — call publishArticle
 * separately, or pass autoPublish via runWeeklyGeneration.
 */
export async function generateDraftForRegion(
  region: Region,
  options: { country?: string; weekOf?: Date; topic?: string } = {}
) {
  const weekOf = options.weekOf ?? mondayOf(new Date());
  const topic = options.topic?.trim() || undefined;

  // A specific admin-requested topic bypasses the curated RSS list (which
  // isn't query-driven) and searches for exactly that story instead of the
  // most-recent general candidate for the region.
  //
  // For the general (non-topic) pipeline, prioritise the current week:
  // search a tight 7-day window first, anchored on the article's own
  // publishing Monday (weekOf) rather than wall-clock "now" — so a
  // regeneration of a past week windows around that week, not today. Only
  // if that comes up empty do we widen to a 2-week-prior fallback.
  const fetchWindow = (cutoffDays: number) =>
    Promise.all([
      fetchCandidatesForRegion(region, { countryFilter: options.country, cutoffDays, anchorDate: weekOf }),
      searchWebCandidates(region, { country: options.country, cutoffDays, anchorDate: weekOf }).catch(() => []),
    ]).then((results) => results.flat());

  let candidates;
  if (topic) {
    candidates = await searchWebCandidates(region, { country: options.country, topic });
  } else {
    candidates = await fetchWindow(7);
    if (candidates.length === 0) candidates = await fetchWindow(14);
  }

  if (candidates.length === 0) throw new NoCandidatesError(options.country ?? region, topic);

  // Most recent first; fall back to the first candidate found if none carry a date.
  const sorted = [...candidates].sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
  );

  // Screen the top of the list against every title already on the site (any
  // status, any region/week) so a later stage of an already-covered story —
  // reported under a different headline — doesn't get written up again.
  const existing = await db.article.findMany({
    select: { title: true },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  const chosen = await selectFreshCandidate(sorted.slice(0, 10), existing.map((a) => a.title));
  if (!chosen) throw new AllCandidatesDuplicateError(options.country ?? region, topic);

  const { corroboratingSources: poolCorroboration } = crossCheck(chosen, candidates);

  // The region-wide candidate pool only incidentally turns up corroborating
  // coverage of the *same* story; run a targeted search for it too, so an
  // article isn't left backed by a single source whenever that overlap misses.
  const extraCorroboration =
    poolCorroboration.length < 2
      ? await findCorroboratingSources(chosen, poolCorroboration).catch(() => [])
      : [];
  const corroboratingSources = [...poolCorroboration, ...extraCorroboration];
  const reliabilityScore = 1 + corroboratingSources.length;

  const draft = await generateArticleDraft({
    region,
    country: options.country,
    candidate: chosen,
    corroboratingSources,
    weekOf,
  });
  draft.reliabilityScore = reliabilityScore;

  const article = await db.article.create({
    data: {
      slug: draft.slug,
      title: draft.title,
      region: draft.region,
      country: draft.country,
      status: "DRAFT",
      summaryP1: draft.summaryP1,
      summaryP2: draft.summaryP2,
      summaryP3: draft.summaryP3 ?? null,
      didYouKnow: draft.didYouKnow,
      strategicRelevance: draft.strategicRelevance,
      militaryPerspective: draft.militaryPerspective,
      singaporeImpact: draft.singaporeImpact ?? null,
      bullets: JSON.stringify(draft.bullets),
      images: JSON.stringify(draft.images),
      sources: JSON.stringify(draft.sources),
      reliabilityScore: draft.reliabilityScore,
      articleDate: draft.articleDate ?? null,
      weekOf: draft.weekOf,
      month: getMonth(draft.weekOf) + 1,
      year: getYear(draft.weekOf),
      createdBy: "bot",
    },
  });

  return article;
}

/**
 * The weekly Monday-morning run: generates one draft per enabled region and,
 * by default, publishes them immediately (archiving the previous week),
 * matching the "auto generated and published" requirement. Regions with no
 * usable candidates are skipped, not fatal to the run.
 */
export async function runWeeklyGeneration(options: { autoPublish?: boolean } = {}) {
  const { autoPublish = true } = options;
  const weekOf = mondayOf(new Date());

  const regionSettings = await db.regionSetting.findMany();
  const disabled = new Set(regionSettings.filter((r) => !r.enabled).map((r) => r.region));
  const regions = [...CORE_REGIONS, ...OPTIONAL_REGIONS].filter((r) => !disabled.has(r));

  const created: { region: Region; articleId: string | null; error?: string }[] = [];

  for (const region of regions) {
    try {
      const article = await generateDraftForRegion(region, { weekOf });
      created.push({ region, articleId: article.id });
    } catch (e) {
      created.push({ region, articleId: null, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (autoPublish) {
    const publishedIds: string[] = [];
    for (const c of created) {
      if (!c.articleId) continue;
      await publishArticle(c.articleId);
      publishedIds.push(c.articleId);
    }

    if (publishedIds.length > 0) {
      const publishedArticles = await db.article.findMany({
        where: { id: { in: publishedIds } },
        select: { title: true, slug: true, region: true, country: true },
      });
      await notifyWeeklyPublished(
        publishedArticles.map((a) => ({
          title: a.title,
          slug: a.slug,
          regionLabel: REGION_LABELS[a.region],
          country: a.country,
        }))
      );
    }
  }

  return created;
}
