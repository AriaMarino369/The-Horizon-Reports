import Link from "next/link";
import type { Role } from "@/lib/session";
import { NavLinks, MobileNav } from "@/app/components/MobileNav";

export function SiteHeader({ role }: { role: Role | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-baseline gap-3">
          <span className="stencil truncate text-base font-bold tracking-widest text-foreground sm:text-xl lg:text-2xl">
            Data Driven Combat Readiness
          </span>
          <span className="hidden font-mono text-[10px] tracking-[0.25em] text-gold sm:inline">
            / NEWS UPDATE
          </span>
        </Link>
        <NavLinks role={role} className="hidden shrink-0 items-center gap-3 font-mono text-xs sm:flex" />
        <MobileNav role={role} />
      </div>
    </header>
  );
}
