import Link from "next/link";
import { db } from "@/lib/db";
import { REGION_LABELS } from "@/lib/sources";
import { storyDateLabel, weekLabel } from "@/lib/weeks";
import { ReliabilityBadge } from "@/app/components/ReliabilityBadge";
import { deleteArticleAction } from "@/app/actions/admin";
import { DeleteButton } from "@/app/components/DeleteButton";
import { HideAnalysisButton } from "@/app/admin/(protected)/edit/HideAnalysisButton";
import { HideSingaporeImpactButton } from "@/app/admin/(protected)/edit/HideSingaporeImpactButton";

// Most archived articles are more than this many weeks old and get collapsed
// behind a <details> toggle by default, so opening the page doesn't dump
// every week ever archived onto the screen at once — only the most recent
// handful of weeks stay expanded.
const EXPANDED_WEEK_COUNT = 2;

export default async function ArchivedPage() {
  const archived = await db.article.findMany({
    where: { status: "ARCHIVED" },
    orderBy: [{ weekOf: "desc" }, { region: "asc" }],
  });

  const weeks: { weekOf: Date; articles: typeof archived }[] = [];
  for (const a of archived) {
    const last = weeks[weeks.length - 1];
    if (last && last.weekOf.getTime() === a.weekOf.getTime()) {
      last.articles.push(a);
    } else {
      weeks.push({ weekOf: a.weekOf, articles: [a] });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="stencil text-xl text-foreground">Archived</h1>
      <p className="font-mono text-xs text-muted">
        Past weeks&apos; briefings — still visible in the public Archive sidebar. Delete permanently
        removes one; there&apos;s no undo. Grouped by week, newest first — only the most recent{" "}
        {EXPANDED_WEEK_COUNT} weeks are expanded by default.
      </p>

      {weeks.length === 0 ? (
        <p className="rounded border border-border bg-panel p-6 text-center text-sm text-muted">
          Nothing archived yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {weeks.map((w, i) => (
            <details key={w.weekOf.toISOString()} open={i < EXPANDED_WEEK_COUNT}>
              <summary className="stencil cursor-pointer rounded border border-border bg-panel px-4 py-2 text-xs tracking-widest text-gold hover:border-gold transition-colors">
                {weekLabel(w.weekOf)} ({w.articles.length})
              </summary>
              <div className="mt-2 flex flex-col gap-3">
                {w.articles.map((a) => (
                  <div key={a.id} className="rounded border border-border bg-panel p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="stencil text-xs tracking-widest text-gold">
                        {REGION_LABELS[a.region]}
                        {a.country ? ` · ${a.country}` : ""} —{" "}
                        {storyDateLabel(a.articleDate, a.publishedAt, a.weekOf)}
                      </p>
                      <ReliabilityBadge score={a.reliabilityScore} />
                    </div>
                    <h2 className="mb-3 text-lg font-semibold text-foreground">{a.title}</h2>
                    <div className="flex flex-wrap gap-2 font-mono text-xs">
                      <Link
                        href={`/article/${a.slug}`}
                        target="_blank"
                        className="rounded border border-accent px-3 py-1.5 text-accent-strong hover:bg-accent hover:text-background transition-colors"
                      >
                        View live
                      </Link>
                      <Link
                        href={`/admin/edit/${a.id}`}
                        className="rounded border border-border px-3 py-1.5 text-foreground hover:border-accent transition-colors"
                      >
                        Edit
                      </Link>
                      <DeleteButton
                        action={deleteArticleAction}
                        articleId={a.id}
                        confirmText="Permanently delete this archived article? This cannot be undone."
                      />
                      <HideAnalysisButton articleId={a.id} hidden={a.analysisHidden} />
                      <HideSingaporeImpactButton articleId={a.id} hidden={a.singaporeImpactHidden} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
