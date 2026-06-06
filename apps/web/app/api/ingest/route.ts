/**
 * POST/GET /api/ingest — fiyat toplama worker'ını tetikler (Değişmez kural #1:
 * Steam'e bu server-side route üzerinden, yalnız worker mantığıyla gidilir;
 * tarayıcı asla doğrudan Steam'e istek atmaz).
 *
 * INGEST_CRON_SECRET (veya Vercel CRON_SECRET) ile korunur. Vercel Cron GET +
 * `Authorization: Bearer <CRON_SECRET>` gönderir. Serverless süresine sığması
 * için sayfa sayısı sınırlıdır (?pages=N, varsayılan 5); tam tarama için
 * `pnpm ingest:once` veya uzun süreli cron kullanılır.
 */
import { type NextRequest, NextResponse } from "next/server";
import { runIngest } from "price-ingest";
import { runScan } from "price-ingest/scan";
import { recordRun } from "price-ingest/runs";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secrets = [process.env.INGEST_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean);
  if (secrets.length === 0) return false;
  const auth = req.headers.get("authorization");
  const fromQuery = req.nextUrl.searchParams.get("secret");
  return secrets.some((s) => auth === `Bearer ${s}` || fromQuery === s);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const pagesParam = Number(req.nextUrl.searchParams.get("pages") ?? "5");
  const maxPages = Number.isFinite(pagesParam) && pagesParam > 0 ? pagesParam : 5;
  // Fiyat güncellemesinden sonra fırsat cache'ini tazele (?scan=0 ile atlanabilir).
  const doScan = req.nextUrl.searchParams.get("scan") !== "0";
  try {
    const report = await recordRun("ingest", () => runIngest({ maxPages }));
    const scan = doScan ? await recordRun("scan", () => runScan()) : null;
    return NextResponse.json({ ok: true, report, scan });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
