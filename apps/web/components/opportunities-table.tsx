"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GRADE_BY_KEY } from "shared";
import type { GradeKey, OpportunityListItem } from "@/lib/calc-types";
import { Link } from "@/i18n/navigation";
import { fmtPct, fmtRoi, fmtUsd } from "@/lib/format";

type Filter = "all" | "synthesis" | "craft";

export function OpportunitiesTable({ items }: { items: OpportunityListItem[] }) {
  const t = useTranslations("Opportunities");
  const ts = useTranslations("Synthesis");
  const tcr = useTranslations("Craft");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = items.filter((r) => filter === "all" || r.kind === filter);

  function label(r: OpportunityListItem): string {
    if (r.kind === "synthesis") {
      const cat = String(r.payload.category);
      const grade = String(r.payload.inputGradeKey) as GradeKey;
      const gradeName = GRADE_BY_KEY[grade]?.name ?? grade;
      return `${ts(`categoryLabel.${cat}`)} · ${gradeName} · T${r.payload.tier}`;
    }
    const slot = String(r.payload.slot);
    return `${tcr(`slotLabel.${slot}`)} · T${r.payload.tier}`;
  }

  const href = (r: OpportunityListItem) => (r.kind === "synthesis" ? "/synthesis" : "/craft");

  const Btn = ({ f, children }: { f: Filter; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => setFilter(f)}
      className={
        filter === f
          ? "rounded-md bg-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-100"
          : "rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 transition hover:text-neutral-100"
      }
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Btn f="all">{t("filterAll")}</Btn>
        <Btn f="synthesis">{t("filterSynthesis")}</Btn>
        <Btn f="craft">{t("filterCraft")}</Btn>
      </div>

      {rows.length === 0 ? (
        <p className="text-neutral-400">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{t("colScenario")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("colType")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("colCost")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("colNet")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("colRoi")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("colProfitChance")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-900/40">
                  <td className="px-4 py-2">
                    <Link href={href(r)} className="text-neutral-100 hover:text-red-400">
                      {label(r)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-400">
                    {r.kind === "synthesis" ? t("kindSynthesis") : t("kindCraft")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-300">{fmtUsd(r.costCents)}</td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${
                      r.netCents > 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {fmtUsd(r.netCents)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-medium tabular-nums ${
                      r.roi > 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {fmtRoi(r.roi)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-400">
                    {fmtPct(r.profitProb)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
