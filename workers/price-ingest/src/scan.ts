/**
 * Fırsat tarama (runScan) — fiyat güncellemesinden SONRA çalışır (docs/03 §Fırsat
 * tarayıcı). Tüm sentez (kategori×girdi-kademe×tier) ve üretim (slot×tier)
 * senaryolarını DB'den toplu kurar, `packages/calc` ile değerlendirir ve
 * feasible olanları `opportunities` cache tablosuna (roi DESC) yazar.
 *
 * Saf hesap motoru calc'tadır; bu modül yalnız DB I/O + senaryo kurulumudur.
 */
import { buildScanRepo } from "./scenarios";
import { getDb, getQueryClient, schema } from "db";
import { scanOpportunities } from "calc";

export interface ScanReport {
  synthesisScenarios: number;
  craftScenarios: number;
  feasible: number;
  written: number;
  topRoi: number | null;
}

export async function runScan(): Promise<ScanReport> {
  const { repo, prices } = await buildScanRepo();
  const synthesisCount = repo.synthesisScenarios().length;
  const craftCount = repo.craftScenarios().length;

  const rows = scanOpportunities(repo, prices);

  const db = getDb();
  const sqlc = getQueryClient();

  // Cache'i tazele: eski satırları sil, yenilerini yaz.
  await sqlc`DELETE FROM opportunities`;

  let written = 0;
  if (rows.length > 0) {
    const values = rows.map((r) => ({
      kind: r.kind,
      payload: r.payload as Record<string, unknown>,
      costCents: r.result.costCents,
      evCents: r.result.evSellCents,
      netCents: r.result.netCents,
      roi: String(r.result.roi ?? 0),
      profitProb: String(r.result.profitProb),
      failProb: String(r.result.failProb),
    }));
    // chunk'la (büyük insert'leri böl)
    const CHUNK = 500;
    for (let i = 0; i < values.length; i += CHUNK) {
      const slice = values.slice(i, i + CHUNK);
      await db.insert(schema.opportunities).values(slice);
      written += slice.length;
    }
  }

  return {
    synthesisScenarios: synthesisCount,
    craftScenarios: craftCount,
    feasible: rows.length,
    written,
    topRoi: rows[0]?.result.roi ?? null,
  };
}
