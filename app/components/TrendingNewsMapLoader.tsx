"use client";

import dynamic from "next/dynamic";
import type { TrendingIncidentMapData } from "@/app/components/TrendingNewsMap";

const Map = dynamic(() => import("@/app/components/TrendingNewsMap").then((m) => m.TrendingNewsMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] w-full items-center justify-center rounded border border-border bg-panel font-mono text-xs text-muted">
      Loading map…
    </div>
  ),
});

export function TrendingNewsMapLoader({ incidents }: { incidents: TrendingIncidentMapData[] }) {
  return <Map incidents={incidents} />;
}
