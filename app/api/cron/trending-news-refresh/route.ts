import type { NextRequest } from "next/server";
import { runTrendingNewsRefresh } from "@/lib/trendingNewsRun";
import { db } from "@/lib/db";

export const maxDuration = 300;

// The free Claude Code Remote Routine ("FG Intel trending news refresh")
// runs this exact job on the identical schedule (01:00/13:00 UTC). If it
// already completed this cycle, running the paid search again here would
// just duplicate the same web-search spend for no benefit — so skip if any
// incident was written very recently. This guard is scoped to this
// unattended cron route only; it never affects the admin's manual
// "Refresh Now" button (lib/trendingNewsRun.ts itself has no such guard),
// which should always run instantly when deliberately clicked.
const RECENT_RUN_GUARD_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const recentlyRun = await db.trendingIncident.findFirst({
    where: { createdAt: { gte: new Date(Date.now() - RECENT_RUN_GUARD_MS) } },
    select: { id: true },
  });
  if (recentlyRun) {
    return Response.json({
      success: true,
      skipped: "Already refreshed within the last 30 minutes (likely by the free Routine) — skipping to avoid duplicate spend.",
    });
  }

  try {
    const result = await runTrendingNewsRefresh();
    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
