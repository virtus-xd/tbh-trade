/**
 * Worker çalışma logu — her ingest/scan'i `ingest_runs` tablosuna yazar
 * (health dashboard + "worker düzenli çalışıyor" görünürlüğü için).
 */
import { getDb, schema } from "db";

export async function recordRun<T>(kind: "ingest" | "scan", fn: () => Promise<T>): Promise<T> {
  const startedAt = new Date();
  const t0 = Date.now();
  const db = getDb();
  try {
    const report = await fn();
    await db.insert(schema.ingestRuns).values({
      kind,
      ok: true,
      startedAt,
      finishedAt: new Date(),
      durationMs: Date.now() - t0,
      stats: report as Record<string, unknown>,
    });
    return report;
  } catch (err) {
    // Log yazımı asıl hatayı gölgelemesin.
    try {
      await db.insert(schema.ingestRuns).values({
        kind,
        ok: false,
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      });
    } catch {
      /* yut */
    }
    throw err;
  }
}
