"use client";

import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABEL: Record<string, string> = { en: "EN", tr: "TR" };

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const current = (params.locale as string) ?? routing.defaultLocale;
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1 text-xs" aria-label="Language">
      {routing.locales.map((loc) => {
        const active = loc === current;
        return (
          <button
            key={loc}
            type="button"
            disabled={active || pending}
            onClick={() =>
              startTransition(() => {
                // pathname locale öneki içermez; router locale'i değiştirir.
                router.replace(pathname, { locale: loc });
              })
            }
            className={
              active
                ? "rounded bg-neutral-700 px-2 py-1 font-medium text-neutral-100"
                : "rounded px-2 py-1 text-neutral-400 transition hover:text-neutral-100"
            }
          >
            {LABEL[loc] ?? loc.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
