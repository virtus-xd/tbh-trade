import type { PricePoint } from "@/lib/calc-types";
import { fmtUsd } from "@/lib/format";

/**
 * Bağımlılıksız inline SVG fiyat trendi: dolgulu alan + çizgi + min/maks/güncel
 * etiketleri. price_history doldukça zenginleşir (Faz 6 cila).
 */
export function TrendChart({
  points,
  labels,
  width = 560,
  height = 120,
}: {
  points: PricePoint[];
  labels: { current: string; min: string; max: string };
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.cents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 6;
  const stepX = width / (points.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const linePts = points.map((p, i) => `${(i * stepX).toFixed(1)},${y(p.cents).toFixed(1)}`);
  const line = `M${linePts.join(" L")}`;
  const area = `M0,${height} L${linePts.join(" L")} L${width},${height} Z`;
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const up = last >= first;
  const stroke = up ? "#34d399" : "#f87171";

  return (
    <div>
      <div className="mb-3 flex gap-6 text-sm">
        <Stat label={labels.current} value={fmtUsd(last)} strong />
        <Stat label={labels.max} value={fmtUsd(max)} />
        <Stat label={labels.min} value={fmtUsd(min)} />
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" preserveAspectRatio="none" role="img">
        <path d={area} fill={stroke} fillOpacity={0.12} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`tabular-nums ${strong ? "text-lg font-semibold text-neutral-100" : "text-neutral-300"}`}>
        {value}
      </div>
    </div>
  );
}
