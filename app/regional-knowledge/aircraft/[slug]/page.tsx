import Link from "next/link";
import { notFound } from "next/navigation";
import { getAircraftBySlug, getSimilarAircraft, getRelatedIncidents } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/app/components/SiteHeader";
import { SourcesList } from "@/app/components/SourcesList";
import { AircraftSilhouette } from "@/app/components/AircraftSilhouette";
import {
  AIRCRAFT_ROLE_LABELS,
  WEAPON_CATEGORY_LABELS,
  COUNTRY_FLAGS,
  parseOperators,
  resolveAircraftView,
} from "@/lib/regionalKnowledge";
import { proxiedImageUrl } from "@/lib/imageProxy";
import type { ArticleSource } from "@/lib/types";

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function StatBarItem({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex-1 min-w-[120px]">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export default async function AircraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ country?: string; variant?: string }>;
}) {
  const { slug } = await params;
  const { country, variant } = await searchParams;
  const aircraft = await getAircraftBySlug(slug);
  if (!aircraft) notFound();

  const [session, similar, incidents] = await Promise.all([
    getSession(),
    getSimilarAircraft(aircraft.id, aircraft.role),
    getRelatedIncidents(aircraft.name),
  ]);

  const sources: ArticleSource[] = JSON.parse(aircraft.sources);
  const operators = parseOperators(aircraft.operatorsInRegion);
  const view = resolveAircraftView(aircraft, country, variant);
  const viewingOperator =
    operators.find((o) => o.country === country && (variant ? o.variant === variant : true)) ??
    operators.find((o) => o.country === country);

  const airbases = new Map(
    aircraft.units.filter((u) => u.airbase).map((u) => [u.airbase!.slug, u.airbase!])
  );

  return (
    <>
      <SiteHeader role={session?.role ?? null} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div>
          <Link href="/regional-knowledge/aircraft" className="font-mono text-xs text-accent hover:underline">
            ← Aircraft Platforms
          </Link>
          <h1 className="stencil mt-2 text-2xl text-foreground">{aircraft.name}</h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gold">
            {aircraft.manufacturer} · {AIRCRAFT_ROLE_LABELS[aircraft.role]}
            {aircraft.originCountry ? ` · ${aircraft.originCountry}` : ""}
          </p>
          {viewingOperator && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-accent">
              Viewing: {viewingOperator.country}
              {viewingOperator.variant ? ` — ${viewingOperator.variant}` : ""}
            </p>
          )}
        </div>

        <div className={aircraft.blueprintImageUrl ? "grid gap-4 sm:grid-cols-2" : undefined}>
          {aircraft.blueprintImageUrl && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-center overflow-hidden rounded border border-border bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- external, arbitrary-host line drawing */}
                <img
                  src={proxiedImageUrl(aircraft.blueprintImageUrl)}
                  alt={`${aircraft.name} 3-view plan/side/front line drawing`}
                  className="aspect-video w-full object-contain"
                />
              </div>
              {(aircraft.blueprintSourceName || aircraft.blueprintLicense) && (
                <p className="font-mono text-[9px] text-muted">
                  {aircraft.blueprintSourceUrl ? (
                    <a href={aircraft.blueprintSourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {aircraft.blueprintSourceName ?? "Source"}
                    </a>
                  ) : (
                    aircraft.blueprintSourceName
                  )}
                  {aircraft.blueprintLicense ? ` · ${aircraft.blueprintLicense}` : ""}
                </p>
              )}
            </div>
          )}

          {view.imageUrl ? (
            <div className="overflow-hidden rounded border border-border bg-panel-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- external, arbitrary-host photo */}
              <img
                src={proxiedImageUrl(view.imageUrl)}
                alt={`${aircraft.name}${viewingOperator ? ` — ${viewingOperator.country}` : ""}`}
                className="aspect-video w-full object-cover"
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-border">
              <AircraftSilhouette role={aircraft.role} className="aspect-video w-full" />
            </div>
          )}
        </div>

        <p className="text-sm leading-relaxed text-foreground">{view.description}</p>

        {/* Development / Operational History — always the generic, worldwide
            narrative regardless of which country's view is selected (unlike
            Description above, which swaps per-operator via resolveAircraftView). */}
        {aircraft.development && (
          <div>
            <p className="stencil mb-2 text-xs tracking-widest text-muted">Development</p>
            <p className="text-sm leading-relaxed text-foreground">{aircraft.development}</p>
          </div>
        )}
        {aircraft.operationalHistory && (
          <div>
            <p className="stencil mb-2 text-xs tracking-widest text-muted">Operational History</p>
            <p className="text-sm leading-relaxed text-foreground">{aircraft.operationalHistory}</p>
          </div>
        )}

        {/* Global reference stats bar — worldwide, not SEA-specific */}
        {(aircraft.maxSpeed ||
          aircraft.combatRadiusNm ||
          aircraft.numberProduced ||
          aircraft.unitPriceUsdMillions ||
          aircraft.activeWorldwide) && (
          <div className="flex flex-wrap gap-4 rounded border border-border bg-panel-2 p-4">
            <StatBarItem label="Max Speed" value={aircraft.maxSpeed} />
            <StatBarItem label="Combat Radius" value={aircraft.combatRadiusNm ? `${aircraft.combatRadiusNm} nm` : null} />
            <StatBarItem label="Produced" value={aircraft.numberProduced ? `${aircraft.numberProduced.toLocaleString()} units` : null} />
            <StatBarItem label="Avg Unit Price" value={aircraft.unitPriceUsdMillions ? `$${aircraft.unitPriceUsdMillions}M` : null} />
            <StatBarItem label="Active Worldwide" value={aircraft.activeWorldwide ? aircraft.activeWorldwide.toLocaleString() : null} />
            <StatBarItem label="Introduced" value={aircraft.yearIntroduced ? String(aircraft.yearIntroduced) : null} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="stencil text-xs tracking-widest text-muted">Technical Specifications</p>
          <Link
            href={`/regional-knowledge/aircraft/compare?a=${aircraft.slug}`}
            className="font-mono text-[10px] uppercase tracking-widest text-accent hover:underline"
          >
            ⊞ Compare →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 rounded border border-border bg-panel p-4 sm:grid-cols-3">
          <Stat label="First Flight" value={aircraft.firstFlight} />
          <Stat label="Crew" value={aircraft.crew} />
          <Stat label="Length" value={aircraft.lengthFt ? `${aircraft.lengthFt} ft` : null} />
          <Stat label="Wingspan" value={aircraft.wingspanFt ? `${aircraft.wingspanFt} ft` : null} />
          <Stat label="Height" value={aircraft.heightFt ? `${aircraft.heightFt} ft` : null} />
          <Stat label="Max Speed" value={aircraft.maxSpeed} />
          <Stat label="Combat Radius" value={aircraft.combatRadiusNm ? `${aircraft.combatRadiusNm} nm` : null} />
          <Stat
            label="Service Ceiling"
            value={aircraft.serviceCeilingFt ? `${aircraft.serviceCeilingFt.toLocaleString()} ft` : null}
          />
          <Stat
            label="Max Takeoff Weight"
            value={aircraft.maxTakeoffWeightLbs ? `${aircraft.maxTakeoffWeightLbs.toLocaleString()} lbs` : null}
          />
          <Stat label="Operational Range" value={aircraft.rangeNm ? `${aircraft.rangeNm.toLocaleString()} nm` : null} />
          <Stat
            label="Total Thrust"
            value={aircraft.totalThrustLbs ? `${aircraft.totalThrustLbs.toLocaleString()} lbf` : null}
          />
          <Stat
            label="Turn Radius Performance"
            value={aircraft.turnRateDegSec ? `${aircraft.turnRateDegSec}°/s sustained` : null}
          />
        </div>

        {aircraft.armamentSummary && (
          <div className="rounded border border-danger/40 bg-panel p-4">
            <p className="stencil mb-2 text-xs tracking-widest text-danger">Armament</p>
            <p className="text-sm leading-relaxed text-foreground">{aircraft.armamentSummary}</p>
          </div>
        )}

        {aircraft.weapons.length > 0 && (
          <div>
            <p className="stencil mb-2 text-xs tracking-widest text-muted">Compatible Weapons</p>
            <div className="flex flex-col gap-3">
              {Object.entries(
                aircraft.weapons.reduce<Record<string, typeof aircraft.weapons>>((groups, w) => {
                  (groups[w.weapon.category] ??= []).push(w);
                  return groups;
                }, {})
              ).map(([category, weapons]) => (
                <div key={category}>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    {WEAPON_CATEGORY_LABELS[category as keyof typeof WEAPON_CATEGORY_LABELS]}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {weapons.map((w) => (
                      <Link
                        key={w.id}
                        href={`/regional-knowledge/weapon/${w.weapon.slug}`}
                        className="rounded border border-border bg-panel px-3 py-1.5 text-xs text-accent hover:border-accent hover:underline"
                      >
                        {w.weapon.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Structured variant table, where researched — falls back to the freeform text below */}
        {aircraft.variantRows.length > 0 ? (
          <div>
            <p className="stencil mb-2 text-xs tracking-widest text-muted">Variants</p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-panel-2">
                  <tr>
                    <th className="p-2 font-mono text-[10px] uppercase tracking-widest text-muted">Variant</th>
                    <th className="p-2 font-mono text-[10px] uppercase tracking-widest text-muted">Customer</th>
                    <th className="p-2 font-mono text-[10px] uppercase tracking-widest text-muted">Built / Ordered</th>
                    <th className="p-2 font-mono text-[10px] uppercase tracking-widest text-muted">Defining Hardware</th>
                  </tr>
                </thead>
                <tbody>
                  {aircraft.variantRows.map((v) => (
                    <tr key={v.id} className="border-t border-border bg-panel">
                      <td className="p-2 font-semibold text-foreground">{v.variantName}</td>
                      <td className="p-2 text-muted">{v.customer ?? "—"}</td>
                      <td className="p-2 text-muted">{v.builtOrOrdered ?? "—"}</td>
                      <td className="p-2 text-muted">{v.definingHardware ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          aircraft.variants && (
            <div>
              <p className="stencil mb-2 text-xs tracking-widest text-muted">Variants</p>
              <p className="text-sm leading-relaxed text-foreground">{aircraft.variants}</p>
            </div>
          )
        )}

        {operators.length > 0 && (
          <div>
            <p className="stencil mb-2 text-xs tracking-widest text-muted">
              All Operators <span className="text-muted">({operators.length})</span>
            </p>
            <div className="flex flex-col gap-2">
              {operators.map((op, i) => (
                <div
                  key={i}
                  className={`rounded border p-3 text-sm ${op.country === country && (op.variant ?? "") === (variant ?? "") ? "border-accent bg-panel-2" : "border-border bg-panel"}`}
                >
                  <Link
                    href={`/regional-knowledge/aircraft/${aircraft.slug}?country=${encodeURIComponent(op.country)}${op.variant ? `&variant=${encodeURIComponent(op.variant)}` : ""}`}
                    className="font-semibold text-accent hover:underline"
                  >
                    {COUNTRY_FLAGS[op.country] ?? ""} {op.country}
                  </Link>
                  {op.variant && <span className="text-muted"> — {op.variant}</span>}
                  {op.approxCount ? <span className="text-muted"> · approx. {op.approxCount}</span> : ""}
                  {" · "}
                  <Link
                    href={`/regional-knowledge/country/${encodeURIComponent(op.country)}`}
                    className="text-muted hover:underline"
                  >
                    view bases →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {airbases.size > 0 && (
          <div>
            <p className="stencil mb-2 text-xs tracking-widest text-muted">
              Air Bases <span className="text-muted">({airbases.size})</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {[...airbases.values()].map((b) => (
                <Link
                  key={b.slug}
                  href={`/regional-knowledge/airbase/${b.slug}`}
                  className="rounded border border-border bg-panel px-3 py-1.5 text-xs text-accent hover:border-accent hover:underline"
                >
                  {b.name} ({b.country})
                </Link>
              ))}
            </div>
          </div>
        )}

        {aircraft.recentEventTitle && aircraft.recentEventUrl && (
          <div>
            <p className="stencil mb-2 text-xs tracking-widest text-muted">Recent Events</p>
            <a
              href={aircraft.recentEventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded border border-border bg-panel p-3 text-sm hover:border-accent"
            >
              <p className="text-accent">{aircraft.recentEventTitle}</p>
              {aircraft.recentEventSummary && (
                <p className="mt-1 text-foreground">{aircraft.recentEventSummary}</p>
              )}
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">
                {aircraft.recentEventSourceName}
                {aircraft.recentEventPublishedAt
                  ? ` · ${aircraft.recentEventPublishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                  : ""}
              </p>
            </a>
          </div>
        )}

        {incidents.length > 0 && (
          <div>
            <p className="stencil mb-2 text-xs tracking-widest text-muted">Related Incidents</p>
            <div className="flex flex-col gap-2">
              {incidents.map((inc) => (
                <Link
                  key={inc.slug}
                  href={`/aviation-safety/${inc.slug}`}
                  className="rounded border border-border bg-panel p-3 text-sm text-foreground hover:border-accent"
                >
                  <span className="text-accent">{inc.title}</span>
                  {inc.incidentDate && (
                    <span className="ml-2 text-xs text-muted">
                      {new Date(inc.incidentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {similar.length > 0 && (
          <div>
            <p className="stencil mb-2 text-xs tracking-widest text-muted">Similar Aircraft</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {similar.map((a) => (
                <div
                  key={a.slug}
                  className="overflow-hidden rounded border border-border bg-panel transition-colors hover:border-accent"
                >
                  <Link href={`/regional-knowledge/aircraft/${a.slug}`}>
                    {a.imageUrl ? (
                      <div className="aspect-video w-full overflow-hidden bg-panel-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- external, arbitrary-host thumbnail */}
                        <img src={proxiedImageUrl(a.imageUrl)} alt={a.name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <AircraftSilhouette role={a.role} className="aspect-video w-full" />
                    )}
                    <p className="p-2 text-xs font-semibold text-foreground">{a.name}</p>
                  </Link>
                  <Link
                    href={`/regional-knowledge/aircraft/compare?a=${aircraft.slug}&b=${a.slug}`}
                    className="block border-t border-border px-2 py-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-accent hover:underline"
                  >
                    ⊞ Compare
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <SourcesList sources={sources} />
      </main>
    </>
  );
}
