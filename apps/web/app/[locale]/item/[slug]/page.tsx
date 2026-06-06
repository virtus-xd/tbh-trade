import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GRADE_BY_KEY } from "shared";
import { loadItemDetail } from "@/lib/calc-data";
import { Link } from "@/i18n/navigation";
import { fmtUsd } from "@/lib/format";
import { TrendChart } from "@/components/trend-chart";

export const revalidate = 3600; // ISR: saatte bir tazele

const getItem = cache(loadItemDetail);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata(props: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const item = await getItem(slug);
  if (!item) return {};
  const t = await getTranslations({ locale, namespace: "Detail" });
  const name = locale === "tr" && item.nameTr ? item.nameTr : item.nameEn;
  return {
    title: t("itemMetaTitle", { name }),
    alternates: {
      canonical: `/item/${slug}`,
      languages: { en: `/item/${slug}`, tr: `/tr/item/${slug}` },
    },
  };
}

export default async function ItemPage(props: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await props.params;
  setRequestLocale(locale);
  const item = await getItem(slug);
  if (!item) notFound();

  const t = await getTranslations("Detail");
  const tcr = await getTranslations("Craft");
  const ts = await getTranslations("Synthesis");
  const grade = GRADE_BY_KEY[item.gradeKey];
  const name = locale === "tr" && item.nameTr ? item.nameTr : item.nameEn;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    category: grade?.name,
    ...(item.price?.lowestCents != null
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: (item.price.lowestCents / 100).toFixed(2),
            url: `${SITE_URL}/item/${slug}`,
          },
        }
      : {}),
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <script
        type="application/ld+json"
        // JSON-LD: `<` kaçışı `</script>` kırılmasını önler (içerik bizim DB'mizden gelse de).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <header className="mb-8">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full ring-1 ring-white/10" style={{ backgroundColor: grade?.colorHex }} />
          <span className="text-sm" style={{ color: grade?.colorHex }}>
            {grade?.name}
          </span>
          <span className="text-sm text-neutral-500">· {t("level")} {item.level}</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{name}</h1>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("priceTitle")}</h2>
        {!item.tradable ? (
          <p className="text-neutral-400">{t("notTradable")}</p>
        ) : item.price ? (
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t("lowest")} value={fmtUsd(item.price.lowestCents)} />
            <Stat label={t("median")} value={fmtUsd(item.price.medianCents)} />
            <Stat label={t("volume")} value={item.price.volume != null ? String(item.price.volume) : "—"} />
          </div>
        ) : (
          <p className="text-neutral-400">{t("notListed")}</p>
        )}
      </section>

      {item.tradable ? (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">{t("trendTitle")}</h2>
          {item.history.length >= 2 ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4">
              <TrendChart
                points={item.history}
                labels={{ current: t("trendCurrent"), min: t("trendMin"), max: t("trendMax") }}
              />
            </div>
          ) : (
            <p className="text-sm text-neutral-500">{t("noTrend")}</p>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("relatedTitle")}</h2>
        {item.craftedBy.length === 0 && item.fromSynthesis.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("noRelated")}</p>
        ) : (
          <div className="space-y-3 text-sm">
            {item.craftedBy.length > 0 ? (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">{t("producedByCraft")}</p>
                <div className="flex flex-wrap gap-2">
                  {item.craftedBy.map((c) => (
                    <Link
                      key={`${c.slot}-${c.tier}`}
                      href="/craft"
                      className="rounded border border-neutral-700 px-2.5 py-1 text-neutral-300 hover:border-neutral-500"
                    >
                      {tcr(`slotLabel.${c.slot}`)} · T{c.tier}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {item.fromSynthesis.length > 0 ? (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">{t("fromSynthesis")}</p>
                <div className="flex flex-wrap gap-2">
                  {item.fromSynthesis.map((s) => (
                    <Link
                      key={`${s.category}-${s.tier}`}
                      href="/synthesis"
                      className="rounded border border-neutral-700 px-2.5 py-1 text-neutral-300 hover:border-neutral-500"
                    >
                      {ts(`categoryLabel.${s.category}`)} · T{s.tier}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-neutral-100">{value}</div>
    </div>
  );
}
