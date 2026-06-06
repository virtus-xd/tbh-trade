/**
 * ThirdPartyProvider — iskelet (örn. steamwebapi.com gibi ücretli sağlayıcı).
 * env PRICE_PROVIDER=thirdparty seçilince devreye girer; eşik kuralında
 * (429 oranı yüksek / kapsam düşük) SteamDirect'ten buraya düşülebilir.
 * Faz 2: imza hazır, implementasyon Faz 6/operasyon kararına bırakıldı.
 */
import type { EnumeratePage, PriceOverview, PriceProvider } from "./types";

export class ThirdPartyProvider implements PriceProvider {
  constructor(private readonly apiKey: string) {}

  enumerate(_start: number, _count: number): Promise<EnumeratePage> {
    throw new Error("ThirdPartyProvider.enumerate henüz implemente edilmedi (Faz 6).");
  }

  priceOverview(_hashName: string): Promise<PriceOverview | null> {
    throw new Error("ThirdPartyProvider.priceOverview henüz implemente edilmedi (Faz 6).");
  }
}
