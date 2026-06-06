import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { loadHealthSummary } from "@/lib/calc-data";
import type { IngestRunRow } from "@/lib/calc-types";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Status" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/status", languages: { en: "/status", tr: "/tr/status" } },
    robots: { index: false }, // operasyonel sayfa — indekslenmesin
  };
}

function pct(part: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

function runDetail(r: IngestRunRow): string {
  const s = r.stats ?? {};
  if (r.kind === "ingest") {
    const mr = s.matchRatePct;
    const pw = s.pricesWritten;
    const h429 = s.http429;
    return `${pw ?? "?"} fiyat · %${mr ?? "?"} · 429:${h429 ?? 0}`;
  }
  return `${s.written ?? "?"} / ${s.feasible ?? "?"} feasible`;
}

export default async function StatusPage(props: { params: Promise<{ locale: string }> }) {
  await connection();
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Status" });
  const format = await getFormatter({ locale });
  const h = await loadHealthSummary();

  const rel = (iso: string | null) => (iso ? format.relativeTime(new Date(iso)) : t("never"));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-neutral-400">{t("description")}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title={t("workerTitle")}>
          <Row label={t("lastIngest")} value={rel(h.lastIngest?.startedAtIso ?? null)} ok={h.lastIngest?.ok} />
          <Row label={t("lastScan")} value={rel(h.lastScan?.startedAtIso ?? null)} ok={h.lastScan?.ok} />
          <Row label={t("lastPrice")} value={rel(h.lastPriceIso)} />
          <Row
            label={t("http429")}
            value={String((h.lastIngest?.stats?.http429 as number | undefined) ?? "—")}
          />
          <Row
            label={t("matchRate")}
            value={
              h.lastIngest?.stats?.matchRatePct != null ? `%${h.lastIngest.stats.matchRatePct as number}` : "—"
            }
          />
        </Card>

        <Card title={t("coverageTitle")}>
          <Row
            label={t("itemsPriced")}
            value={`${h.pricedItems}/${h.tradableItems} (${pct(h.pricedItems, h.tradableItems)})`}
          />
          <Row
            label={t("materialsPriced")}
            value={`${h.pricedMaterials}/${h.tradableMaterials} (${pct(h.pricedMaterials, h.tradableMaterials)})`}
          />
          <Row label={t("pricesTotal")} value={String(h.pricesTotal)} />
        </Card>

        <Card title={t("mappingTitle")}>
          <Row label={t("unmatched")} value={String(h.unmatchedNames)} warn={h.unmatchedNames > 0} />
          <Row label={t("ambiguous")} value={String(h.ambiguousNames)} warn={h.ambiguousNames > 0} />
        </Card>

        <Card title={t("opportunitiesTitle")}>
          <Row label={t("opportunitiesCount")} value={String(h.opportunitiesCount)} />
          <Row label={t("opportunitiesComputed")} value={rel(h.opportunitiesComputedIso)} />
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{t("recentTitle")}</h2>
        {h.recentRuns.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("noRuns")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t("colKind")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("colStatus")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("colWhen")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("colDuration")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("colDetail")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/70">
                {h.recentRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-900/40">
                    <td className="px-4 py-2 text-neutral-300">{r.kind}</td>
                    <td className={`px-4 py-2 ${r.ok ? "text-emerald-400" : "text-red-400"}`}>
                      {r.ok ? t("ok") : t("failed")}
                    </td>
                    <td className="px-4 py-2 text-neutral-400">{rel(r.startedAtIso)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-400">
                      {r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{r.error ? r.error : runDetail(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, ok, warn }: { label: string; value: string; ok?: boolean; warn?: boolean }) {
  const color = ok === false || warn ? "text-amber-400" : ok ? "text-emerald-400" : "text-neutral-100";
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className={`font-medium tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
