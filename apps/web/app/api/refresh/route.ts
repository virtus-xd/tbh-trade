/**
 * POST /api/refresh — tek bir eşya/malzemenin fiyatını anında yeniler.
 * Değişmez kural #1: Steam'e yalnız server-side worker mantığı (refreshOne) gider;
 * item başına COOLDOWN ile ban/429 riski sınırlanır (spam'de cache döner).
 */
import { NextResponse } from "next/server";
import { REF_TYPES } from "shared";
import { refreshOne } from "price-ingest/refresh";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const refType = String(b.refType);
  const id = Number(b.id);
  if (!REF_TYPES.includes(refType as never) || !Number.isInteger(id) || id < 1) {
    return NextResponse.json({ ok: false, error: "invalid refType/id" }, { status: 400 });
  }
  try {
    const data = await refreshOne(refType as "item" | "material", id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
