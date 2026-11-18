"use client";

import "leaflet/dist/leaflet.css";
import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import { formatDistanceToNow } from "date-fns";

export type TrendingIncidentMapData = {
  id: string;
  country: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  category: "AIRSTRIKE" | "UAV_DRONE" | "AIR_DEFENSE" | "AIRCRAFT_LOSS" | "NON_KINETIC" | "OTHER";
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  originalLanguage: string | null;
  publishedAt: string | null; // ISO
};

const CATEGORY_LABELS: Record<TrendingIncidentMapData["category"], string> = {
  AIRSTRIKE: "Airstrike",
  UAV_DRONE: "UAV / Drone",
  AIR_DEFENSE: "Air Defence",
  AIRCRAFT_LOSS: "Aircraft Loss",
  NON_KINETIC: "Non-Kinetic",
  OTHER: "Other",
};

// Fixed categorical hues against the dark basemap — kept distinct and
// legible without implying a severity ranking.
const CATEGORY_COLORS: Record<TrendingIncidentMapData["category"], string> = {
  AIRSTRIKE: "#d9463c",
  UAV_DRONE: "#3987e5",
  AIR_DEFENSE: "#c98500",
  AIRCRAFT_LOSS: "#b03cd9",
  NON_KINETIC: "#2f9e44",
  OTHER: "#a3a68c",
};

// ISO 639-1 -> readable label for the handful of languages this feature is
// likely to actually see; falls back to the bare code for anything else.
const LANGUAGE_LABELS: Record<string, string> = {
  ar: "Arabic",
  ru: "Russian",
  uk: "Ukrainian",
  he: "Hebrew",
  fa: "Persian",
  zh: "Chinese",
  ko: "Korean",
  tr: "Turkish",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
  de: "German",
  id: "Indonesian",
  th: "Thai",
  vi: "Vietnamese",
};

function flagEmoji(cca2: string | null): string {
  if (!cca2 || cca2.length !== 2) return "🏳️";
  const codePoints = [...cca2.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function incidentIcon(color: string) {
  // A soft glowing ring around a solid core — reads as a "heat" pin on a
  // dark basemap without needing a dedicated heatmap plugin.
  return L.divIcon({
    className: "",
    html: `<span style="position:relative;display:block;width:22px;height:22px;">
      <span style="position:absolute;inset:0;border-radius:9999px;background:${color};opacity:0.28;filter:blur(3px);"></span>
      <span style="position:absolute;top:6px;left:6px;width:10px;height:10px;border-radius:9999px;background:${color};box-shadow:0 0 6px 1px ${color};border:1.5px solid #0a0c08;"></span>
    </span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10],
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Date not reported";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Date not reported";
  return `${formatDistanceToNow(d)} ago`;
}

export function TrendingNewsMap({ incidents }: { incidents: TrendingIncidentMapData[] }) {
  const legend = useMemo(
    () => (Object.keys(CATEGORY_LABELS) as TrendingIncidentMapData["category"][]).filter((c) =>
      incidents.some((i) => i.category === c)
    ),
    [incidents]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="trending-dark-tiles h-[460px] w-full overflow-hidden rounded border border-border">
        <MapContainer
          center={[20, 10]}
          zoom={2}
          minZoom={2}
          scrollWheelZoom
          className="h-full w-full"
          style={{ background: "#0a0c08" }}
        >
          {/* Standard free OpenStreetMap tiles (no API key needed), rendered
              in a dark/night tone via a CSS filter on the tile pane only
              (see .trending-dark-tiles in globals.css) — markers and popups
              live in separate Leaflet panes, so they're unaffected. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {incidents.map((inc) => (
            <Marker
              key={inc.id}
              position={[inc.latitude, inc.longitude]}
              icon={incidentIcon(CATEGORY_COLORS[inc.category])}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95} className="trending-tooltip">
                <span className="font-mono text-xs">
                  {flagEmoji(inc.countryCode)} <strong>{inc.country}</strong> — {CATEGORY_LABELS[inc.category]}
                  <br />
                  {inc.title}
                </span>
              </Tooltip>
              <Popup maxWidth={320} className="trending-popup">
                <div className="flex flex-col gap-1.5 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{flagEmoji(inc.countryCode)}</span>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted">
                        {inc.country} · {timeAgo(inc.publishedAt)}
                      </p>
                      <span
                        className="stencil mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-background"
                        style={{ backgroundColor: CATEGORY_COLORS[inc.category] }}
                      >
                        {CATEGORY_LABELS[inc.category]}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold leading-snug text-foreground">{inc.title}</p>
                  <p className="text-muted">{inc.summary}</p>
                  {inc.originalLanguage && (
                    <p className="text-[10px] text-muted">
                      Translated from {LANGUAGE_LABELS[inc.originalLanguage] ?? inc.originalLanguage}.
                    </p>
                  )}
                  <a
                    href={inc.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 border-t border-white/10 pt-1 text-accent-strong underline"
                  >
                    Source: {inc.sourceName}
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {incidents.length === 0 ? (
        <p className="font-mono text-[10px] text-muted">
          No currently active incidents on file — check back after the next refresh cycle.
        </p>
      ) : (
        <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted">
          {legend.map((c) => (
            <span key={c}>
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[c] }}
              />
              {CATEGORY_LABELS[c]}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
