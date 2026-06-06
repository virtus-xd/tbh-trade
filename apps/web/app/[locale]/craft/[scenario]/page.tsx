import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CRAFT_SLOTS } from "shared";
import { craftOptions, evaluateCraftScenario } from "@/lib/calc-data";
import type { CraftSlot } from "@/lib/calc-types";
import { CraftCalculator } from "@/components/craft-calculator";

export const revalidate = 3600;

/** `main_weapon-t8` → {slot, tier}. */
function parseScenario(scenario: string): { slot: CraftSlot; tier: number } | null {
  const m = /^([a-z_]+)-t(\d+)$/.exec(scenario);
  if (!m) return null;
  const [, slot, tierStr] = m;
  if (!slot || !tierStr) return null;
  if (!CRAFT_SLOTS.includes(slot as never)) return null;
  const tier = Number(tierStr);
  if (!Number.isInteger(tier) || tier < 1) return null;
  return { slot: slot as CraftSlot, tier };
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string; scenario: string }>;
}): Promise<Metadata> {
  const { locale, scenario } = await props.params;
  const p = parseScenario(scenario);
  if (!p) return {};
  const t = await getTranslations({ locale, namespace: "Craft" });
  const label = `${t(`slotLabel.${p.slot}`)} · T${p.tier}`;
  return {
    title: `${label} — ${t("metaTitle")}`,
    description: t("metaDescription"),
    alternates: {
      canonical: `/craft/${scenario}`,
      languages: { en: `/craft/${scenario}`, tr: `/tr/craft/${scenario}` },
    },
  };
}

export default async function CraftScenarioPage(props: {
  params: Promise<{ locale: string; scenario: string }>;
}) {
  const { locale, scenario } = await props.params;
  setRequestLocale(locale);
  const p = parseScenario(scenario);
  if (!p) notFound();

  const data = await evaluateCraftScenario(p);
  if (!data) notFound();
  const options = await craftOptions();
  const t = await getTranslations("Craft");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-neutral-400">{t("description")}</p>
      </header>
      <CraftCalculator options={options} initial={data} />
      <footer className="mt-12 border-t border-neutral-900 pt-5 text-xs text-neutral-600">{t("footer")}</footer>
    </main>
  );
}
