import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { craftOptions, evaluateCraftScenario } from "@/lib/calc-data";
import type { CraftOptions, CraftSlot } from "@/lib/calc-types";
import { CraftCalculator } from "@/components/craft-calculator";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Craft" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/craft", languages: { en: "/craft", tr: "/tr/craft" } },
  };
}

/** Varsayılan: ana silah, en yüksek tier (dokümandaki örnek senaryo). */
function pickDefault(options: CraftOptions): { slot: CraftSlot; tier: number } | null {
  const slotOpt = options.slots.find((s) => s.slot === "main_weapon") ?? options.slots[0];
  if (!slotOpt || slotOpt.tiers.length === 0) return null;
  const tier = slotOpt.tiers[slotOpt.tiers.length - 1] ?? slotOpt.tiers[0];
  if (tier == null) return null;
  return { slot: slotOpt.slot, tier };
}

export default async function CraftPage(props: { params: Promise<{ locale: string }> }) {
  await connection();
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Craft" });
  const tc = await getTranslations({ locale, namespace: "Common" });

  const options = await craftOptions();
  const def = pickDefault(options);
  const initial = def ? await evaluateCraftScenario(def) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-neutral-400">{t("description")}</p>
      </header>

      {def && initial ? (
        <CraftCalculator options={options} initial={initial} />
      ) : (
        <p className="text-neutral-400">{tc("noData")}</p>
      )}

      <footer className="mt-12 border-t border-neutral-900 pt-5 text-xs text-neutral-600">
        {t("footer")}
      </footer>
    </main>
  );
}
