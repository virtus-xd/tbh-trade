/** Saf formatlama yardımcıları (client + server). Para cents (USD). */

export function fmtUsd(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtPct(p: number | null | undefined, digits = 1): string {
  if (p == null) return "—";
  return `${(p * 100).toFixed(digits)}%`;
}

/** ROI'yi işaretli yüzde olarak: +12.3% / −4.5% / — (null=farm). */
export function fmtRoi(roi: number | null | undefined): string {
  if (roi == null) return "—";
  const pct = roi * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "bilinmiyor";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "bilinmiyor";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "az önce";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.round(hours / 24);
  return `${days} gün önce`;
}
