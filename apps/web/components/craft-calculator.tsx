"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CraftOptions, CraftResult, CraftSlot } from "@/lib/calc-types";
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

export function CraftCalculator({ options, initial }: { options: CraftOptions; initial: CraftResult }) {
  const t = useTranslations("Craft");
  const [slot, setSlot] = useState<CraftSlot>(initial.meta.slot);
  const [tier, setTier] = useState<number>(initial.meta.tier);
  const [data, setData] = useState<CraftResult>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);

  const slotOpt = options.slots.find((s) => s.slot === slot) ?? options.slots[0];
  const tiers = slotOpt?.tiers ?? [];

  useEffect(() => {
    if (tiers.length > 0 && !tiers.includes(tier)) setTier(tiers[0] as number);
  }, [tiers, tier]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "craft", slot, tier }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "calc failed");
      setData(json.data as CraftResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [slot, tier]);

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label={t("slot")} value={slot} onChange={(v) => setSlot(v as CraftSlot)}>
          {options.slots.map((s) => (
            <option key={s.slot} value={s.slot}>
              {t(`slotLabel.${s.slot}`)}
            </option>
          ))}
        </Select>
        <Select label={t("tier")} value={String(tier)} onChange={(v) => setTier(Number(v))}>
          {tiers.map((tt) => (
            <option key={tt} value={tt}>
              T{tt}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 px-4 py-3">
        <h3 className="mb-2 text-sm font-semibold text-neutral-300">{t("materialsTitle")}</h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-neutral-800/70">
            {m.materials.map((mat) => (
              <tr key={mat.id}>
                <td className="py-1.5 text-neutral-300">{mat.nameEn}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-500">×{mat.qty}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-400">{fmtUsd(mat.unitCents)}</td>
                <td className="py-1.5 text-right tabular-nums text-neutral-200">{fmtUsd(mat.lineCents)}</td>
              </tr>
            ))}
            {m.materials.length === 0 ? (
              <tr>
                <td className="py-1.5 text-neutral-500" colSpan={4}>
                  {t("noMaterials")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {error ? (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className={loading ? "pointer-events-none opacity-60 transition" : "transition"}>
        <ResultPanel
          result={data.result}
          breakeven={{ label: t("breakevenCost"), cents: m.breakevenCostCents }}
          lastUpdatedIso={m.lastUpdatedIso}
          costNote={t("costNote")}
        />
      </div>
    </div>
  );
}
