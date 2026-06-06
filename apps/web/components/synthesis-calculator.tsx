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

const centsToInput = (c: number | null): string => (c == null ? "" : (c / 100).toFixed(2));
const inputToCents = (s: string): number | null => {
  const v = Number.parseFloat(s.replace(",", "."));
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
};

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
  // null = otomatik (en ucuz); sayı = manuel override (cents)
  const [override, setOverride] = useState<number | null>(null);
  const [priceText, setPriceText] = useState<string>(centsToInput(initial.meta.inputUnitCents));
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
        body: JSON.stringify({
          kind: "synthesis",
          category,
          inputGradeKey,
          tier,
          inputUnitCents: override, // null → otomatik en ucuz
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "calc failed");
      const d = json.data as SynthesisResult;
      setData(d);
      // Manuel değilse alanı kullanılan (otomatik) fiyata senkronla.
      if (!d.meta.inputManual) setPriceText(centsToInput(d.meta.inputUnitCents));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [category, inputGradeKey, tier, override]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void run();
  }, [run]);

  // Senaryo seçiciyi değiştirince override'ı sıfırla (piyasayı takip et).
  const onScenarioChange = (fn: () => void) => {
    setOverride(null);
    fn();
  };

  const applyManual = () => {
    const cents = inputToCents(priceText);
    if (cents == null) return;
    setOverride(cents); // run effect tetiklenir
  };

  const resetToMarket = () => {
    setOverride(null);
    setPriceText(centsToInput(data.meta.inputAutoCents));
  };

  const m = data.meta;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select label={t("category")} value={category} onChange={(v) => onScenarioChange(() => setCategory(v as SynthCategory))}>
          {options.categories.map((c) => (
            <option key={c.key} value={c.key}>
              {t(`categoryLabel.${c.key}`)}
            </option>
          ))}
        </Select>
        <Select label={t("tier")} value={String(tier)} onChange={(v) => onScenarioChange(() => setTier(Number(v)))}>
          {tiers.map((tt) => (
            <option key={tt.tier} value={tt.tier}>
              T{tt.tier}
            </option>
          ))}
        </Select>
        <Select label={t("inputGrade")} value={inputGradeKey} onChange={(v) => onScenarioChange(() => setInputGradeKey(v as GradeKey))}>
          {inputGrades.map((g) => (
            <option key={g} value={g}>
              {GRADE_BY_KEY[g]?.name ?? g}
            </option>
          ))}
        </Select>
      </div>

      {/* Girdi-başı fiyat: düzenlenebilir (varsayılan = otomatik en ucuz) */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-neutral-500">{t("inputPriceLabel")}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              onBlur={applyManual}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyManual();
                }
              }}
              className="w-32 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 focus:border-red-500 focus:outline-none"
            />
          </label>
          {m.inputManual ? (
            <button
              type="button"
              onClick={resetToMarket}
              className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400 transition hover:text-neutral-100"
            >
              {t("inputReset")}
            </button>
          ) : null}
          {m.inputManual ? (
            <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
              {t("inputManualBadge")}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {t("inputAutoHint", {
            count: m.inputPoolSize,
            price: m.inputAutoCents != null ? fmtUsd(m.inputAutoCents) : "—",
          })}
        </p>
      </div>

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
