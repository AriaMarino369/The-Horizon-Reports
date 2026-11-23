import Link from "next/link";
import { notFound } from "next/navigation";
import { getAircraftForCompare, getAircraftPickerList } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/app/components/SiteHeader";
import { AircraftSilhouette } from "@/app/components/AircraftSilhouette";
import { AIRCRAFT_ROLE_LABELS } from "@/lib/regionalKnowledge";
import { proxiedImageUrl } from "@/lib/imageProxy";

type Metric = {
  label: string;
  unit: string;
  get: (a: NonNullable<Awaited<ReturnType<typeof getAircraftForCompare>>>) => number | null;
};

// Full diff-table rows — every comparable numeric spec this database tracks.
const METRICS: Metric[] = [
  { label: "Total Thrust", unit: "lbf", get: (a) => a.totalThrustLbs },
  { label: "Max Weight", unit: "lbs", get: (a) => a.maxTakeoffWeightLbs },
  { label: "Max Speed", unit: "kt", get: (a) => a.maxSpeedKnots },
  { label: "Operational Range", unit: "nm", get: (a) => a.rangeNm },
  { label: "Combat Radius", unit: "nm", get: (a) => a.combatRadiusNm },
  { label: "Operational Ceiling", unit: "ft", get: (a) => a.serviceCeilingFt },
  { label: "Turn Radius Performance", unit: "°/s", get: (a) => a.turnRateDegSec },
  { label: "Length", unit: "ft", get: (a) => a.lengthFt },
  { label: "Wingspan", unit: "ft", get: (a) => a.wingspanFt },
  { label: "Height", unit: "ft", get: (a) => a.heightFt },
  { label: "Crew", unit: "", get: (a) => a.crew },
  { label: "Number Produced", unit: "units", get: (a) => a.numberProduced },
  { label: "Unit Price", unit: "$M", get: (a) => a.unitPriceUsdMillions },
  { label: "Active Worldwide", unit: "", get: (a) => a.activeWorldwide },
];

// The 6 axes shown on the "At a Glance" radar chart specifically — a fixed
// set distinct from the full table above, per product spec.
const RADAR_METRICS: Metric[] = [
  { label: "Total Thrust", unit: "lbf", get: (a) => a.totalThrustLbs },
  { label: "Max Weight", unit: "lbs", get: (a) => a.maxTakeoffWeightLbs },
  { label: "Max Speed", unit: "kt", get: (a) => a.maxSpeedKnots },
  { label: "Operational Range", unit: "nm", get: (a) => a.rangeNm },
  { label: "Operational Ceiling", unit: "ft", get: (a) => a.serviceCeilingFt },
  { label: "Turn Radius Performance", unit: "°/s", get: (a) => a.turnRateDegSec },
];

// Axis names live in a plain list beside the chart instead of wrapping
// around it — six multi-word labels crammed against the plotted polygons
// made the chart itself unreadable, however carefully the text was
// anchored. The chart only needs a short numbered marker per vertex; the
// list is what actually carries the label text.
function RadarChart({ axes, seriesA, seriesB }: { axes: string[]; seriesA: number[]; seriesB: number[] }) {
  const size = 240;
  const center = size / 2;
  const radius = size / 2 - 30;
  const n = axes.length;
  if (n < 3) return null;

  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const maxPerAxis = axes.map((_, i) => Math.max(seriesA[i], seriesB[i], 1));

  const pointFor = (values: number[]) =>
    values
      .map((v, i) => {
        const normalized = Math.max(0, Math.min(1, v / maxPerAxis[i]));
        const angle = angleFor(i);
        const x = center + Math.cos(angle) * radius * normalized;
        const y = center + Math.sin(angle) * radius * normalized;
        return `${x},${y}`;
      })
      .join(" ");

  const gridRings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px] shrink-0">
        {gridRings.map((r) => (
          <polygon
            key={r}
            points={axes
              .map((_, i) => {
                const angle = angleFor(i);
                return `${center + Math.cos(angle) * radius * r},${center + Math.sin(angle) * radius * r}`;
              })
              .join(" ")}
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />
        ))}
        <polygon points={pointFor(seriesA)} fill="var(--color-accent)" fillOpacity={0.15} stroke="var(--color-accent)" strokeWidth={2} />
        <polygon points={pointFor(seriesB)} fill="var(--color-gold)" fillOpacity={0.15} stroke="var(--color-gold)" strokeWidth={2} />
        {axes.map((label, i) => {
          const angle = angleFor(i);
          const x = center + Math.cos(angle) * (radius + 14);
          const y = center + Math.sin(angle) * (radius + 14);
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground"
              fontSize={10}
              fontFamily="monospace"
            >
              {i + 1}
            </text>
          );
        })}
      </svg>
      <ol className="flex flex-col gap-1 font-mono text-[10px] text-muted sm:w-44 sm:shrink-0">
        {axes.map((label, i) => (
          <li key={label} className="flex gap-1.5">
            <span className="text-foreground">{i + 1}.</span>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a: slugA, b: slugB } = await searchParams;
  const session = await getSession();

  if (!slugA) notFound();
  const aircraftA = await getAircraftForCompare(slugA);
  if (!aircraftA) notFound();

  const aircraftB = slugB ? await getAircraftForCompare(slugB) : null;
  const pickerList = await getAircraftPickerList();

  return (
    <>
      <SiteHeader role={session?.role ?? null} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div>
          <Link href={`/regional-knowledge/aircraft/${aircraftA.slug}`} className="font-mono text-xs text-accent hover:underline">
            ← {aircraftA.name}
          </Link>
          <h1 className="stencil mt-2 text-2xl text-foreground">
            {aircraftA.name}
            {aircraftB ? ` vs ${aircraftB.name}` : ": Compare"}
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-xs text-muted">
            Platform-level spec comparison — figures are worldwide reference stats (production totals, unit price,
            active fleet size), not SEA-specific operator data. Highlighted values mark which aircraft reports the
            larger figure for that metric; this is a magnitude comparison only, not a verdict on which platform is
            better suited to a role.
          </p>
        </div>

        <form method="GET" className="flex flex-wrap items-center gap-2 rounded border border-border bg-panel p-3">
          <input type="hidden" name="a" value={aircraftA.slug} />
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Compare against</label>
          <select
            name="b"
            defaultValue={aircraftB?.slug ?? ""}
            className="flex-1 rounded border border-border bg-panel-2 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="" disabled>
              Select aircraft...
            </option>
            {pickerList
              .filter((p) => p.slug !== aircraftA.slug)
              .map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
          </select>
          <button
            type="submit"
            className="rounded border border-accent px-3 py-1.5 font-mono text-xs text-accent hover:bg-accent hover:text-background"
          >
            Compare
          </button>
        </form>

        {!aircraftB ? (
          <p className="rounded border border-border bg-panel p-6 text-center text-sm text-muted">
            Pick a second aircraft above to compare — any platform type, not just the same role.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[aircraftA, aircraftB].map((ac, idx) => (
                <div key={ac.slug} className="overflow-hidden rounded border border-border bg-panel">
                  {ac.imageUrl ? (
                    <div className="aspect-video w-full overflow-hidden bg-panel-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- external, arbitrary-host photo */}
                      <img src={proxiedImageUrl(ac.imageUrl)} alt={ac.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <AircraftSilhouette role={ac.role} className="aspect-video w-full" />
                  )}
                  <div className="p-2">
                    <p className={`text-xs font-semibold ${idx === 0 ? "text-accent" : "text-gold"}`}>{ac.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      {AIRCRAFT_ROLE_LABELS[ac.role]}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-panel-2">
                  <tr>
                    <th className="p-2 font-mono text-[10px] uppercase tracking-widest text-muted">Metric</th>
                    <th className="p-2 font-mono text-[10px] uppercase tracking-widest text-accent">{aircraftA.name}</th>
                    <th className="p-2 font-mono text-[10px] uppercase tracking-widest text-gold">{aircraftB.name}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border bg-panel">
                    <td className="p-2 text-muted">Manufacturer</td>
                    <td className="p-2 text-foreground">{aircraftA.manufacturer}</td>
                    <td className="p-2 text-foreground">{aircraftB.manufacturer}</td>
                  </tr>
                  <tr className="border-t border-border bg-panel">
                    <td className="p-2 text-muted">Origin</td>
                    <td className="p-2 text-foreground">{aircraftA.originCountry ?? "—"}</td>
                    <td className="p-2 text-foreground">{aircraftB.originCountry ?? "—"}</td>
                  </tr>
                  <tr className="border-t border-border bg-panel">
                    <td className="p-2 text-muted">First Flight</td>
                    <td className="p-2 text-foreground">{aircraftA.firstFlight ?? "—"}</td>
                    <td className="p-2 text-foreground">{aircraftB.firstFlight ?? "—"}</td>
                  </tr>
                  <tr className="border-t border-border bg-panel">
                    <td className="p-2 text-muted">Max Speed</td>
                    <td className="p-2 text-foreground">{aircraftA.maxSpeed ?? "—"}</td>
                    <td className="p-2 text-foreground">{aircraftB.maxSpeed ?? "—"}</td>
                  </tr>
                  {METRICS.map((m) => {
                    const vA = m.get(aircraftA);
                    const vB = m.get(aircraftB);
                    if (vA === null && vB === null) return null;
                    const aWins = vA !== null && (vB === null || vA > vB);
                    const bWins = vB !== null && (vA === null || vB > vA);
                    return (
                      <tr key={m.label} className="border-t border-border bg-panel">
                        <td className="p-2 text-muted">{m.label}</td>
                        <td className={`p-2 ${aWins ? "font-semibold text-accent-strong" : vA !== null ? "text-danger" : "text-muted"}`}>
                          {vA !== null ? `${vA.toLocaleString()} ${m.unit}` : "—"}
                        </td>
                        <td className={`p-2 ${bWins ? "font-semibold text-accent-strong" : vB !== null ? "text-danger" : "text-muted"}`}>
                          {vB !== null ? `${vB.toLocaleString()} ${m.unit}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {(() => {
              const chartMetrics = RADAR_METRICS.filter((m) => m.get(aircraftA) !== null && m.get(aircraftB) !== null);
              if (chartMetrics.length < 3) return null;
              return (
                <div className="rounded border border-border bg-panel p-4">
                  <p className="stencil mb-2 text-xs tracking-widest text-muted">At a Glance</p>
                  <RadarChart
                    axes={chartMetrics.map((m) => m.label)}
                    seriesA={chartMetrics.map((m) => m.get(aircraftA)!)}
                    seriesB={chartMetrics.map((m) => m.get(aircraftB)!)}
                  />
                  <div className="mt-3 flex justify-center gap-4 font-mono text-[10px] uppercase tracking-widest">
                    <p className="text-accent">● {aircraftA.name}</p>
                    <p className="text-gold">● {aircraftB.name}</p>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </main>
    </>
  );
}
