import Link from "next/link";
import { notFound } from "next/navigation";
import { getWeaponForCompare, getWeaponPickerList } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/app/components/SiteHeader";
import { WEAPON_CATEGORY_LABELS } from "@/lib/regionalKnowledge";
import { proxiedImageUrl } from "@/lib/imageProxy";

type WeaponForCompare = NonNullable<Awaited<ReturnType<typeof getWeaponForCompare>>>;

type Metric = {
  label: string;
  unit: string;
  get: (w: WeaponForCompare) => number | null;
};

// Numeric specs this database tracks for weapons — shown with win/lose
// highlighting, same convention as the aircraft compare table.
const METRICS: Metric[] = [
  { label: "Range", unit: "nm", get: (w) => w.rangeNm },
  { label: "Length", unit: "in", get: (w) => w.lengthIn },
  { label: "Diameter", unit: "in", get: (w) => w.diameterIn },
  { label: "Weight", unit: "lbs", get: (w) => w.weightLbs },
];

export default async function WeaponComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a: slugA, b: slugB } = await searchParams;
  const session = await getSession();

  if (!slugA) notFound();
  const weaponA = await getWeaponForCompare(slugA);
  if (!weaponA) notFound();

  const weaponB = slugB ? await getWeaponForCompare(slugB) : null;
  const pickerList = await getWeaponPickerList();

  return (
    <>
      <SiteHeader role={session?.role ?? null} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div>
          <Link href={`/regional-knowledge/weapon/${weaponA.slug}`} className="font-mono text-xs text-accent hover:underline">
            ← {weaponA.name}
          </Link>
          <h1 className="stencil mt-2 text-2xl text-foreground">
            {weaponA.name}
            {weaponB ? ` vs ${weaponB.name}` : ": Compare"}
          </h1>
          <p className="mt-2 max-w-2xl font-mono text-xs text-muted">
            Munition-level spec comparison — Range, Speed and Warhead are the headline figures, plus every other
            numeric spec this database tracks. Highlighted values mark which munition reports the larger figure for
            that metric; this is a magnitude comparison only, not a verdict on which weapon is more effective in a
            given role (guided vs. unguided, anti-air vs. anti-ship figures aren't directly comparable).
          </p>
        </div>

        <form method="GET" className="flex flex-wrap items-center gap-2 rounded border border-border bg-panel p-3">
          <input type="hidden" name="a" value={weaponA.slug} />
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted">Compare against</label>
          <select
            name="b"
            defaultValue={weaponB?.slug ?? ""}
            className="flex-1 rounded border border-border bg-panel-2 px-2 py-1.5 text-sm text-foreground"
          >
            <option value="" disabled>
              Select weapon...
            </option>
            {pickerList
              .filter((p) => p.slug !== weaponA.slug)
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

        {!weaponB ? (
          <p className="rounded border border-border bg-panel p-6 text-center text-sm text-muted">
            Pick a second weapon above to compare — any type, not just the same category.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[weaponA, weaponB].map((w, idx) => (
                <div key={w.slug} className="overflow-hidden rounded border border-border bg-panel">
                  <div className="aspect-video w-full overflow-hidden bg-panel-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- external, arbitrary-host photo */}
                    <img src={proxiedImageUrl(w.imageUrl)} alt={w.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-2">
                    <p className={`text-xs font-semibold ${idx === 0 ? "text-accent" : "text-gold"}`}>{w.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      {WEAPON_CATEGORY_LABELS[w.category]}
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
                    <th className="p-2 font-mono text-[10px] uppercase tracking-widest text-accent">{weaponA.name}</th>
                    <th className="p-2 font-mono text-[10px] uppercase tracking-widest text-gold">{weaponB.name}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border bg-panel">
                    <td className="p-2 text-muted">Manufacturer</td>
                    <td className="p-2 text-foreground">{weaponA.manufacturer}</td>
                    <td className="p-2 text-foreground">{weaponB.manufacturer}</td>
                  </tr>
                  <tr className="border-t border-border bg-panel">
                    <td className="p-2 text-muted">Guidance</td>
                    <td className="p-2 text-foreground">{weaponA.guidance ?? "—"}</td>
                    <td className="p-2 text-foreground">{weaponB.guidance ?? "—"}</td>
                  </tr>
                  <tr className="border-t border-border bg-panel">
                    <td className="p-2 text-muted">Speed</td>
                    <td className="p-2 text-foreground">{weaponA.speed ?? "—"}</td>
                    <td className="p-2 text-foreground">{weaponB.speed ?? "—"}</td>
                  </tr>
                  <tr className="border-t border-border bg-panel">
                    <td className="p-2 text-muted">Warhead</td>
                    <td className="p-2 text-foreground">{weaponA.warhead ?? "—"}</td>
                    <td className="p-2 text-foreground">{weaponB.warhead ?? "—"}</td>
                  </tr>
                  {METRICS.map((m) => {
                    const vA = m.get(weaponA);
                    const vB = m.get(weaponB);
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
          </>
        )}
      </main>
    </>
  );
}
