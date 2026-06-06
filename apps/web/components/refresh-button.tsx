"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { RefType } from "@/lib/calc-types";

/**
 * "Güncel fiyatları al" — tek item/material'i anında yeniler (/api/refresh).
 * Sunucu tarafı item-başı cooldown ile Steam'i korur; başarıdan sonra
 * router.refresh() ile sayfa taze fiyatla yeniden render edilir.
 */
export function RefreshButton({ refType, id }: { refType: RefType; id: number }) {
  const t = useTranslations("Detail");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refType, id }),
      });
      const json = await res.json();
      if (!json.ok) {
        setNote(t("refreshError"));
        return;
      }
      if (json.data.refreshed) {
        setNote(t("refreshedNote"));
        startTransition(() => router.refresh());
      } else if (json.data.reason === "cooldown") {
        setNote(t("cooldownNote"));
      } else {
        setNote(t("refreshError"));
      }
    } catch {
      setNote(t("refreshError"));
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || pending;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition hover:border-red-500/60 disabled:opacity-50"
      >
        {busy ? t("refreshing") : t("refresh")}
      </button>
      {note ? <span className="text-xs text-neutral-500">{note}</span> : null}
    </div>
  );
}
