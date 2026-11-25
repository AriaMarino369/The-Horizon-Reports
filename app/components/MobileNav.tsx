"use client";

import Link from "next/link";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import type { Role } from "@/lib/session";

const LINK_STYLE: Record<string, string> = {
  danger: "border-danger/60 text-danger hover:bg-danger hover:text-background",
  accent: "border-accent/60 text-accent hover:bg-accent hover:text-background",
  gold: "border-gold/60 text-gold hover:bg-gold hover:text-background",
  "accent-strong": "border-accent text-accent-strong hover:bg-accent hover:text-background",
  foreground: "border-foreground/60 text-foreground hover:bg-foreground hover:text-background",
};

const NAV_ITEMS: { href: string; label: string; color: keyof typeof LINK_STYLE }[] = [
  { href: "/", label: "Weekly News", color: "foreground" },
  { href: "/aviation-safety", label: "Aviation Safety", color: "danger" },
  { href: "/news-feeds", label: "Trending News", color: "accent" },
  { href: "/regional-knowledge", label: "Regional Knowledge", color: "gold" },
];

/** Shared pill-style nav links, used by both the always-visible desktop row and the mobile dropdown. */
export function NavLinks({ role, className }: { role: Role | null; className: string }) {
  return (
    <nav className={className}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`rounded border px-3 py-1.5 transition-colors ${LINK_STYLE[item.color]}`}
        >
          {item.label}
        </Link>
      ))}
      {(role === "admin" || role === "master") && (
        <Link
          href="/admin"
          className="rounded border border-accent px-3 py-1.5 text-accent-strong transition-colors hover:bg-accent hover:text-background"
        >
          Admin
        </Link>
      )}
      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded border border-border px-3 py-1.5 text-left text-muted transition-colors hover:border-danger hover:text-danger"
        >
          Log out
        </button>
      </form>
    </nav>
  );
}

/** Hamburger toggle + dropdown panel — only rendered below the `sm` breakpoint. */
export function MobileNav({ role }: { role: Role | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded border border-border"
      >
        <span className={`h-0.5 w-5 bg-foreground transition-transform ${open ? "translate-y-2 rotate-45" : ""}`} />
        <span className={`h-0.5 w-5 bg-foreground transition-opacity ${open ? "opacity-0" : ""}`} />
        <span className={`h-0.5 w-5 bg-foreground transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded border border-border bg-panel p-3 shadow-lg">
          <NavLinks role={role} className="flex flex-col gap-2 font-mono text-xs" />
        </div>
      )}
    </div>
  );
}
