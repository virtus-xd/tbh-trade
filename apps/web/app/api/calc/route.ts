/**
 * POST /api/calc — senaryo → EvalResult (packages/calc + DB cache fiyatları).
 * Tarayıcı buraya senaryo gönderir; Steam'e asla gitmez (Değişmez kural #1).
 */
import { NextResponse } from "next/server";
import { CRAFT_SLOTS, GRADE_KEYS, SYNTH_CATEGORIES } from "shared";
import { evaluateCraftScenario, evaluateSynthesisScenario } from "@/lib/calc-data";
import type { CalcRequest } from "@/lib/calc-types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function parse(body: unknown): CalcRequest | { error: string } {
  if (typeof body !== "object" || body == null) return { error: "geçersiz gövde" };
  const b = body as Record<string, unknown>;
  const tier = Number(b.tier);
  if (!Number.isInteger(tier) || tier < 1) return { error: "geçersiz tier" };

  if (b.kind === "synthesis") {
    const category = String(b.category);
    const inputGradeKey = String(b.inputGradeKey);
    if (!SYNTH_CATEGORIES.includes(category as never)) return { error: "geçersiz kategori" };
    if (!GRADE_KEYS.includes(inputGradeKey as never)) return { error: "geçersiz kademe" };
    return { kind: "synthesis", category: category as never, inputGradeKey: inputGradeKey as never, tier };
  }
  if (b.kind === "craft") {
    const slot = String(b.slot);
    if (!CRAFT_SLOTS.includes(slot as never)) return { error: "geçersiz slot" };
    return { kind: "craft", slot: slot as never, tier };
  }
  return { error: "geçersiz kind" };
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON ayrıştırılamadı" }, { status: 400 });
  }

  const parsed = parse(body);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    if (parsed.kind === "synthesis") {
      const data = await evaluateSynthesisScenario(parsed);
      return NextResponse.json({ ok: true, data });
    }
    const data = await evaluateCraftScenario(parsed);
    if (!data) return NextResponse.json({ ok: false, error: "reçete bulunamadı" }, { status: 404 });
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
