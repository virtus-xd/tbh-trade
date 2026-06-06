"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";

const LINKS = [
  { href: "/", key: "home" },
  { href: "/synthesis", key: "synthesis" },
  { href: "/craft", key: "craft" },
  { href: "/opportunities", key: "opportunities" },
  { href: "/methodology", key: "methodology" },
] as const;

export function SiteNav() {
  const t = useTranslations("Common.nav");
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-900">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-6 py-3 text-sm">
        <Link href="/" className="mr-3 font-semibold tracking-tight text-neutral-100">
          TBH Trade
        </Link>
        <div className="flex flex-1 flex-wrap gap-1">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  active
                    ? "rounded px-2.5 py-1 font-medium text-neutral-100"
                    : "rounded px-2.5 py-1 text-neutral-400 transition hover:text-neutral-100"
                }
              >
                {t(l.key)}
              </Link>
            );
          })}
        </div>
        <LocaleSwitcher />
      </nav>
    </header>
  );
}
