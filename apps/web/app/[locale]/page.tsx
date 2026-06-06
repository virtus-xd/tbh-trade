import { getTranslations, setRequestLocale } from "next-intl/server";
import { GRADES, TRADABLE_MIN_GRADE } from "shared";
import { Link } from "@/i18n/navigation";

export default async function Home(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-red-500">
          Task Bar Hero · appid 3678970
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("title")}</h1>
        <p className="mt-4 max-w-2xl text-lg text-neutral-400">{t("tagline")}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/synthesis"
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            {t("ctaSynthesis")}
          </Link>
          <Link
            href="/craft"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
          >
            {t("ctaCraft")}
          </Link>
          <Link
            href="/opportunities"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
          >
            {t("ctaOpportunities")}
          </Link>
        </div>
      </header>

      <section>
        <h2 className="mb-1 text-xl font-semibold">{t("ladderTitle")}</h2>
        <p className="mb-5 text-sm text-neutral-500">
          {t("ladderNote", { count: GRADES.length, minGrade: TRADABLE_MIN_GRADE })}
        </p>

        <ul className="space-y-1.5">
          {GRADES.map((g) => (
            <li
              key={g.key}
              className="flex items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900/50 px-4 py-2.5"
            >
              <span className="w-6 text-right text-xs tabular-nums text-neutral-600">{g.tierIndex}</span>
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-white/10"
                style={{ backgroundColor: g.colorHex }}
                aria-hidden
              />
              <span className="font-medium" style={{ color: g.colorHex }}>
                {g.name}
              </span>
              <span className="ml-auto flex items-center gap-3 text-xs text-neutral-500">
                <span className="tabular-nums">
                  {g.alchemyGold.toLocaleString("en-US")} {t("goldSuffix")}
                </span>
                {g.tradable ? (
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400">
                    {t("tradable")}
                  </span>
                ) : (
                  <span className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-500">$0</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
