"use client";

import { useFormatter, useTranslations } from "next-intl";
import { GRADE_BY_KEY, GRADE_KEYS } from "shared";
import type { EvalResult, GradeKey } from "@/lib/calc-types";
import { fmtPct, fmtRoi, fmtUsd } from "@/lib/format";

interface Badge {
  label: string;
  tone: "warn" | "info" | "muted";
}

export interface ResultPanelProps {
  result: EvalResult;
  /** Başabaş satırı (sentez: girdi-başı; üretim: toplam maliyet). */
  breakeven: { label: string; cents: number };
  lastUpdatedIso: string | null;
  costNote?: string;
  extraBadges?: Badge[];
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  const color = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-neutral-100";
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function badgeClass(tone: Badge["tone"]): string {
  if (tone === "warn") return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  if (tone === "info") return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  return "border-neutral-700 bg-neutral-800/60 text-neutral-400";
}

export function ResultPanel({ result, breakeven, lastUpdatedIso, costNote, extraBadges }: ResultPanelProps) {
  const t = useTranslations("Result");
  const format = useFormatter();
  const net = result.netCents;
  const sortedOutcomes = [...result.outcomes].sort(
    (a, b) => GRADE_KEYS.indexOf(a.gradeKey) - GRADE_KEYS.indexOf(b.gradeKey),
  );

  const badges: Badge[] = [...(extraBadges ?? [])];
  if (result.farmMode) badges.push({ label: t("farmMode"), tone: "info" });
  if (result.hasMissingPrices) badges.push({ label: t("missingPrices"), tone: "warn" });
  badges.push({ label: t("datamined"), tone: "muted" });

  const updated = lastUpdatedIso ? format.relativeTime(new Date(lastUpdatedIso)) : "—";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={t("cost")} value={fmtUsd(result.costCents)} />
        <Stat label={t("expectedRevenue")} value={fmtUsd(result.evSellCents)} />
        <Stat label={t("net")} value={fmtUsd(net)} tone={net > 0 ? "pos" : net < 0 ? "neg" : undefined} />
        <Stat
          label={t("roi")}
          value={fmtRoi(result.roi)}
          tone={result.roi == null ? undefined : result.roi > 0 ? "pos" : "neg"}
        />
        <Stat label={t("profitChance")} value={fmtPct(result.profitProb)} />
        <Stat label={t("failChance")} value={fmtPct(result.failProb)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {badges.map((b, i) => (
          <span key={i} className={`rounded border px-2 py-0.5 ${badgeClass(b.tone)}`}>
            {b.label}
          </span>
        ))}
        <span className="ml-auto text-neutral-600">{t("priceUpdated", { time: updated })}</span>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-neutral-400">{breakeven.label}</span>
          <span className="font-semibold tabular-nums text-neutral-100">{fmtUsd(breakeven.cents)}</span>
        </div>
        {costNote ? <p className="mt-1 text-xs text-neutral-600">{costNote}</p> : null}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-neutral-300">{t("distributionTitle")}</h3>
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{t("colGrade")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("colProbability")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("colAvgSell")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {sortedOutcomes.map((o) => {
                const meta = GRADE_BY_KEY[o.gradeKey as GradeKey];
                return (
                  <tr key={o.gradeKey} className="hover:bg-neutral-900/40">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-1 ring-white/10"
                          style={{ backgroundColor: meta?.colorHex }}
                          aria-hidden
                        />
                        <span style={{ color: meta?.colorHex }}>{meta?.name ?? o.gradeKey}</span>
                        {o.isFail ? (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                            {t("fail")}
                          </span>
                        ) : null}
                        {o.isGreat ? (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                            {t("greatSuccess")}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-300">{fmtPct(o.prob, 2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-400">
                      {o.poolAvgSell > 0 ? fmtUsd(Math.round(o.poolAvgSell)) : "$0"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
