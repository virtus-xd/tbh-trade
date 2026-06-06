import type { MetadataRoute } from "next";
import {
  allItemSlugs,
  allMaterialSlugs,
  craftOptions,
  synthesisOptions,
} from "@/lib/calc-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Bir path için en (öneksiz) + tr (/tr) alternatifli sitemap girdisi. */
function entry(path: string, priority: number): MetadataRoute.Sitemap[number] {
  const en = `${SITE_URL}${path}`;
  const tr = `${SITE_URL}/tr${path}`;
  return {
    url: en,
    priority,
    alternates: { languages: { en, tr } },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    entry("", 1),
    entry("/synthesis", 0.9),
    entry("/craft", 0.9),
    entry("/opportunities", 0.8),
    entry("/methodology", 0.5),
  ];

  // Senaryo URL'leri (kalıcı, SEO)
  const [synth, craft] = await Promise.all([synthesisOptions(), craftOptions()]);
  for (const c of synth.categories) {
    for (const to of c.tiers) {
      for (const g of to.inputGrades) {
        entries.push(entry(`/synthesis/${c.key}-${g}-t${to.tier}`, 0.7));
      }
    }
  }
  for (const s of craft.slots) {
    for (const t of s.tiers) {
      entries.push(entry(`/craft/${s.slot}-t${t}`, 0.7));
    }
  }

  // Eşya + malzeme detayları
  const [items, materials] = await Promise.all([allItemSlugs(), allMaterialSlugs()]);
  for (const slug of items) entries.push(entry(`/item/${slug}`, 0.5));
  for (const slug of materials) entries.push(entry(`/material/${slug}`, 0.6));

  return entries;
}
