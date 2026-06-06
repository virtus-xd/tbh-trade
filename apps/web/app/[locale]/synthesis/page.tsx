import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { evaluateSynthesisScenario, synthesisOptions } from "@/lib/calc-data";
import type { GradeKey, SynthCategoryOption, SynthesisOptions } from "@/lib/calc-types";
import { SynthesisCalculator } from "@/components/synthesis-calculator";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Synthesis" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/synthesis", languages: { en: "/synthesis", tr: "/tr/synthesis" } },
  };
}

/** Anlamlı varsayılan: gear + immortal girdi (fail mekaniğini gösterir). */
function pickDefault(
  options: SynthesisOptions,
): { category: SynthCategoryOption["key"]; tier: number; inputGradeKey: GradeKey } | null {
  const cat = options.categories.find((c) => c.key === "gear") ?? options.categories[0];
  if (!cat || cat.tiers.length === 0) return null;
  const tierOpt =
    cat.tiers.find((t) => t.inputGrades.includes("immortal")) ??
    cat.tiers[cat.tiers.length - 1] ??
    cat.tiers[0];
  if (!tierOpt) return null;
  const inputGradeKey =
    (tierOpt.inputGrades.includes("immortal") ? "immortal" : tierOpt.inputGrades[0]) ?? null;
  if (!inputGradeKey) return null;
  return { category: cat.key, tier: tierOpt.tier, inputGradeKey };
}

export default async function SynthesisPage(props: { params: Promise<{ locale: string }> }) {
  await connection();
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Synthesis" });
  const tc = await getTranslations({ locale, namespace: "Common" });

  const options = await synthesisOptions();
  const def = pickDefault(options);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-neutral-400">{t("description", { fail: t("failWord") })}</p>
      </header>

      {def ? (
        <SynthesisCalculator options={options} initial={await evaluateSynthesisScenario(def)} />
      ) : (
        <p className="text-neutral-400">{tc("noData")}</p>
      )}

      <footer className="mt-12 border-t border-neutral-900 pt-5 text-xs text-neutral-600">
        {t("footer")}
      </footer>
    </main>
  );
}
