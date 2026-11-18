"use client";

import { useActionState } from "react";
import { runTrendingNewsRefreshAction } from "@/app/actions/admin";

export function TrendingNewsRefreshForm() {
  const [state, action, pending] = useActionState(runTrendingNewsRefreshAction, undefined);

  return (
    <div className="flex flex-col gap-2 rounded border border-gold/40 bg-panel p-4">
      <p className="stencil text-xs tracking-widest text-gold">Trending News — Global Conflict Map</p>
      <p className="text-xs text-muted">
        Normally runs automatically twice a day (09:00 and 21:00 SGT). Use this to pull in
        current incidents right now instead of waiting for the next scheduled run — results
        appear on the map at /news-feeds.
      </p>
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="stencil rounded border border-gold px-4 py-2 text-xs font-semibold tracking-widest text-gold transition-colors hover:bg-gold hover:text-background disabled:opacity-60"
        >
          {pending ? "Searching worldwide…" : "Refresh Now"}
        </button>
      </form>
      {state?.error && <p className="font-mono text-xs text-danger">{state.error}</p>}
      {state?.message && <p className="font-mono text-xs text-accent-strong">{state.message}</p>}
    </div>
  );
}
