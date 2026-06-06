import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GRADE_BY_KEY, GRADE_KEYS, SYNTH_CATEGORIES } from "shared";
import { evaluateSynthesisScenario, synthesisOptions } from "@/lib/calc-data";
import type { GradeKey, SynthCategory } from "@/lib/calc-types";
import { SynthesisCalculator } from "@/components/synthesis-calculator";

export const revalidate = 3600;

interface Parsed {
  category: SynthCategory;
  inputGradeKey: GradeKey;
  tier: number;
}

/** `gear-immortal-t6` → {category, grade, tier}. */
function parseScenario(scenario: string): Parsed | null {
  const m = /^([a-z]+)-([a-z]+)-t(\d+)$/.exec(scenario);
  if (!m) return null;
  const [, category, grade, tierStr] = m;
  if (!category || !grade || !tierStr) return null;
  if (!SYNTH_CATEGORIES.includes(category as never)) return null;
  if (!GRADE_KEYS.includes(grade as never)) return null;
  const tier = Number(tierStr);
  if (!Number.isInteger(tier) || tier < 1) return null;
  return { category: category as SynthCategory, inputGradeKey: grade as GradeKey, tier };
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string; scenario: string }>;
}): Promise<Metadata> {
  const { locale, scenario } = await props.params;
  const p = parseScenario(scenario);
  if (!p) return {};
  const t = await getTranslations({ locale, namespace: "Synthesis" });
  const gradeName = GRADE_BY_KEY[p.inputGradeKey]?.name ?? p.inputGradeKey;
  const label = `${t(`categoryLabel.${p.category}`)} · ${gradeName} · T${p.tier}`;
  return {
    title: `${label} — ${t("metaTitle")}`,
    description: t("metaDescription"),
    alternates: {
      canonical: `/synthesis/${scenario}`,
      languages: { en: `/synthesis/${scenario}`, tr: `/tr/synthesis/${scenario}` },
    },
  };
}

export default async function SynthesisScenarioPage(props: {
  params: Promise<{ locale: string; scenario: string }>;
}) {
  const { locale, scenario } = await props.params;
  setRequestLocale(locale);
  const p = parseScenario(scenario);
  if (!p) notFound();

  const data = await evaluateSynthesisScenario(p);
  if (data.result.outcomes.length === 0) notFound();
  const options = await synthesisOptions();
  const t = await getTranslations("Synthesis");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-neutral-400">{t("description", { fail: t("failWord") })}</p>
      </header>
      <SynthesisCalculator options={options} initial={data} />
      <footer className="mt-12 border-t border-neutral-900 pt-5 text-xs text-neutral-600">{t("footer")}</footer>
    </main>
  );
}
