import Link from "next/link";
import { db } from "@/lib/db";
import { replaceAircraftImageAction, replaceWeaponImageAction } from "@/app/actions/admin";
import { ImageRowForm } from "./ImageRowForm";

export default async function RegionalKnowledgeImagesPage() {
  const [aircraft, weapons] = await Promise.all([
    db.militaryAircraft.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, manufacturer: true, imageUrl: true },
    }),
    db.weapon.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, manufacturer: true, imageUrl: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/regional-knowledge" className="font-mono text-xs text-accent hover:underline">
          ← Regional Knowledge
        </Link>
        <h1 className="stencil mt-2 text-xl text-foreground">Fix Images</h1>
        <p className="mt-1 max-w-2xl font-mono text-xs text-muted">
          Every aircraft/weapon photo here is hotlinked from a third-party source and routed through{" "}
          <code>/api/image-proxy</code> for caching and hotlink protection — but a source can still take
          a photo down entirely. If something shows broken on the public site, find it below and either
          upload a saved copy or paste a different working URL. Changes apply immediately, no publish
          step needed.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="stencil text-xs tracking-widest text-accent-strong">Aircraft ({aircraft.length})</h2>
        <div className="flex flex-col gap-2">
          {aircraft.map((a) => (
            <ImageRowForm
              key={a.id}
              title={a.name}
              subtitle={a.manufacturer}
              currentImageUrl={a.imageUrl}
              idFieldName="aircraftId"
              idValue={a.id}
              action={replaceAircraftImageAction}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="stencil text-xs tracking-widest text-danger">Weapons ({weapons.length})</h2>
        <div className="flex flex-col gap-2">
          {weapons.map((w) => (
            <ImageRowForm
              key={w.id}
              title={w.name}
              subtitle={w.manufacturer}
              currentImageUrl={w.imageUrl}
              idFieldName="weaponId"
              idValue={w.id}
              action={replaceWeaponImageAction}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
