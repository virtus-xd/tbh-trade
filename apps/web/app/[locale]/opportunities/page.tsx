import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { GRADE_BY_KEY } from "shared";
import { loadOpportunities } from "@/lib/calc-data";
import type { GradeKey, OpportunityListItem } from "@/lib/calc-types";
import { Link } from "@/i18n/navigation";
import { fmtRoi, fmtUsd } from "@/lib/format";
import { OpportunitiesTable } from "@/components/opportunities-table";

export const dynamic = "force-dynamic"; // canlı fırsat cache'i (her istekte oku)

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Opportunities" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: "/opportunities",
      languages: { en: "/opportunities", tr: "/tr/opportunities" },
    },
  };
}

export default async function OpportunitiesPage(props: { params: Promise<{ locale: string }> }) {
  await connection(); // her istekte dinamik render (cache'ten taze fırsatlar)
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Opportunities" });
  const ts = await getTranslations({ locale, namespace: "Synthesis" });
  const tcr = await getTranslations({ locale, namespace: "Craft" });
  const items = await loadOpportunities();

  function label(r: OpportunityListItem): string {
    if (r.kind === "synthesis") {
      const grade = String(r.payload.inputGradeKey) as GradeKey;
      const gradeName = GRADE_BY_KEY[grade]?.name ?? grade;
      return `${ts(`categoryLabel.${String(r.payload.category)}`)} · ${gradeName} · T${r.payload.tier}`;
    }
    return `${tcr(`slotLabel.${String(r.payload.slot)}`)} · T${r.payload.tier}`;
  }

  const featured = items.slice(0, 3);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-neutral-400">{t("description")}</p>
      </header>

      {featured.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            {t("featuredTitle")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {featured.map((r) => (
              <Link
                key={r.id}
                href={r.kind === "synthesis" ? "/synthesis" : "/craft"}
                className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 transition hover:border-red-500/50"
              >
                <div className="text-xs uppercase tracking-wide text-neutral-500">
                  {r.kind === "synthesis" ? t("kindSynthesis") : t("kindCraft")}
                </div>
                <div className="mt-1 font-medium text-neutral-100">{label(r)}</div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold tabular-nums text-emerald-400">{fmtRoi(r.roi)}</span>
                  <span className="text-sm text-neutral-400">
                    {t("featuredNet")} {fmtUsd(r.netCents)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <OpportunitiesTable items={items} />
    </main>
  );
}
