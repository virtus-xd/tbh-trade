"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GRADE_BY_KEY } from "shared";
import type { GradeKey, SynthCategory, SynthesisOptions, SynthesisResult } from "@/lib/calc-types";
import { fmtUsd } from "@/lib/format";
import { ResultPanel } from "./result-panel";

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs uppercase tracking-wide text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 focus:border-red-500 focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

export function SynthesisCalculator({
  options,
  initial,
}: {
  options: SynthesisOptions;
  initial: SynthesisResult;
}) {
  const t = useTranslations("Synthesis");
  const tRes = useTranslations("Result");
  const [category, setCategory] = useState<SynthCategory>(initial.meta.category);
  const [tier, setTier] = useState<number>(initial.meta.tier);
  const [inputGradeKey, setInputGradeKey] = useState<GradeKey>(initial.meta.inputGradeKey);
  const [data, setData] = useState<SynthesisResult>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);

  const cat = options.categories.find((c) => c.key === category) ?? options.categories[0];
  const tiers = cat?.tiers ?? [];
  const tierOpt = tiers.find((tt) => tt.tier === tier) ?? tiers[0];
  const inputGrades = tierOpt?.inputGrades ?? [];

  useEffect(() => {
    if (tierOpt && tierOpt.tier !== tier) setTier(tierOpt.tier);
  }, [tierOpt, tier]);
  useEffect(() => {
    if (inputGrades.length > 0 && !inputGrades.includes(inputGradeKey)) {
      setInputGradeKey(inputGrades[0] as GradeKey);
    }
  }, [inputGrades, inputGradeKey]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "synthesis", category, inputGradeKey, tier }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "calc failed");
      setData(json.data as SynthesisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [category, inputGradeKey, tier]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void run();
  }, [run]);

  const m = data.meta;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select label={t("category")} value={category} onChange={(v) => setCategory(v as SynthCategory)}>
          {options.categories.map((c) => (
            <option key={c.key} value={c.key}>
              {t(`categoryLabel.${c.key}`)}
            </option>
          ))}
        </Select>
        <Select label={t("tier")} value={String(tier)} onChange={(v) => setTier(Number(v))}>
          {tiers.map((tt) => (
            <option key={tt.tier} value={tt.tier}>
              T{tt.tier}
            </option>
          ))}
        </Select>
        <Select label={t("inputGrade")} value={inputGradeKey} onChange={(v) => setInputGradeKey(v as GradeKey)}>
          {inputGrades.map((g) => (
            <option key={g} value={g}>
              {GRADE_BY_KEY[g]?.name ?? g}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-xs text-neutral-500">
        {t("inputPriceLine", {
          price: m.inputUnitCents != null ? fmtUsd(m.inputUnitCents) : "—",
          count: m.inputPoolSize,
        })}
      </p>

      {error ? (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {tRes("missingPrices")}: {error}
        </p>
      ) : null}

      <div className={loading ? "pointer-events-none opacity-60 transition" : "transition"}>
        <ResultPanel
          result={data.result}
          breakeven={{ label: t("breakevenInput"), cents: m.breakevenInputCents }}
          lastUpdatedIso={m.lastUpdatedIso}
          costNote={data.result.farmMode ? t("costNoteFarm") : t("costNoteNormal")}
          extraBadges={
            m.inputPriceMissing ? [{ label: tRes("inputPriceMissing"), tone: "warn" as const }] : []
          }
        />
      </div>
    </div>
  );
}
