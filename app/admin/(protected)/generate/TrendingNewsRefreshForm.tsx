"use client";

import { useActionState } from "react";
import { runTrendingNewsRefreshAction, requestFreeTrendingNewsRefreshAction } from "@/app/actions/admin";

export function TrendingNewsRefreshForm({ hasPendingFreeRequest }: { hasPendingFreeRequest: boolean }) {
  const [state, action, pending] = useActionState(runTrendingNewsRefreshAction, undefined);
  const [freeState, freeAction, freePending] = useActionState(requestFreeTrendingNewsRefreshAction, undefined);

  return (
    <div className="flex flex-col gap-2 rounded border border-gold/40 bg-panel p-4">
      <p className="stencil text-xs tracking-widest text-gold">Trending News — Global Conflict Map</p>
      <p className="text-xs text-muted">
        Normally runs automatically every 6 hours (06:00, 12:00, 18:00, and 00:00 SGT). Use this to pull in
        current incidents right now instead of waiting for the next scheduled run — results
        appear on the map at /news-feeds.
      </p>
      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className="stencil rounded border border-gold px-4 py-2 text-xs font-semibold tracking-widest text-gold transition-colors hover:bg-gold hover:text-background disabled:opacity-60"
          >
            {pending ? "Searching worldwide…" : "Refresh Now (paid API)"}
          </button>
        </form>
        <form action={freeAction}>
          <button
            type="submit"
            disabled={freePending || hasPendingFreeRequest}
            className="stencil rounded border border-accent px-4 py-2 text-xs font-semibold tracking-widest text-accent-strong transition-colors hover:bg-accent hover:text-background disabled:opacity-60"
          >
            {freePending
              ? "Queuing…"
              : hasPendingFreeRequest
                ? "Free Refresh Queued…"
                : "Request Free Refresh"}
          </button>
        </form>
      </div>
      <p className="font-mono text-[10px] text-muted">
        Free Refresh costs nothing — it&apos;s picked up by the hourly free-generation job, usually within
        the hour, instead of calling the paid API right now.
      </p>
      {state?.error && <p className="font-mono text-xs text-danger">{state.error}</p>}
      {state?.message && <p className="font-mono text-xs text-accent-strong">{state.message}</p>}
      {freeState?.error && <p className="font-mono text-xs text-danger">{freeState.error}</p>}
      {freeState?.ok && (
        <p className="font-mono text-xs text-accent-strong">Queued — it&apos;ll run within the hour.</p>
      )}
    </div>
  );
}
