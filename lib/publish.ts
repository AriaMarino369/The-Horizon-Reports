import "server-only";
import { db } from "@/lib/db";

/** Archives every PUBLISHED article from a prior week once a new week goes live. */
export async function archivePriorWeeks(currentWeekOf: Date) {
  return db.article.updateMany({
    where: { status: "PUBLISHED", weekOf: { lt: currentWeekOf } },
    data: { status: "ARCHIVED" },
  });
}

/**
 * Publishes an article, archiving both prior weeks' published articles and
 * any other already-published article in the same region/country/week (so
 * publishing a freshly generated draft doubles as "swap the pre-generated
 * news" for that slot, even after the original was already published).
 *
 * `country` is part of the swap key, not just `region`: for the six fixed
 * regions it's always null, so this is a no-op change there. For `CUSTOM`
 * region, though, several distinct countries' articles are meant to coexist
 * in the same week — matching on `region` alone treated every CUSTOM article
 * as one shared slot, so publishing e.g. an Israel piece would silently
 * archive an already-published, completely unrelated Iran piece from the
 * same week.
 */
export async function publishArticle(articleId: string) {
  const article = await db.article.findUniqueOrThrow({ where: { id: articleId } });
  await archivePriorWeeks(article.weekOf);
  await db.article.updateMany({
    where: {
      status: "PUBLISHED",
      weekOf: article.weekOf,
      region: article.region,
      country: article.country,
      id: { not: articleId },
    },
    data: { status: "ARCHIVED" },
  });
  await db.article.update({
    where: { id: articleId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  await refreshDigest(article.weekOf);
}

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

/** Rebuilds the week's digest roundup from whatever is currently published for it. */
export async function refreshDigest(weekOf: Date) {
  const published = await db.article.findMany({ where: { status: "PUBLISHED", weekOf } });
  if (published.length === 0) {
    // Nothing left published for this week (e.g. everything got archived or
    // deleted) — clear the digest instead of leaving stale text/links behind.
    await db.weeklyDigest.deleteMany({ where: { weekOf } });
    return;
  }
  const summaryText = published.map((a) => firstSentence(a.summaryP1)).join(" ");
  const articleIds = published.map((a) => a.id);
  await db.weeklyDigest.upsert({
    where: { weekOf },
    update: { summaryText, articleIds: JSON.stringify(articleIds) },
    create: { weekOf, summaryText, articleIds: JSON.stringify(articleIds) },
  });
}
