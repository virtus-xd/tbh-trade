import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Methodology" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: "/methodology",
      languages: { en: "/methodology", tr: "/tr/methodology" },
    },
  };
}

export default async function MethodologyPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("Methodology");

  const sections = ["odds", "price", "fee", "tradable", "fail"] as const;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-neutral-400">{t("intro")}</p>
      </header>

      <div className="space-y-6">
        {sections.map((s) => (
          <section key={s}>
            <h2 className="mb-1 text-lg font-semibold text-neutral-100">{t(`${s}Title`)}</h2>
            <p className="text-sm leading-relaxed text-neutral-400">{t(`${s}Body`)}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
