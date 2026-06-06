import { config } from "../config";
import { SteamDirectProvider } from "./steam-direct";
import { ThirdPartyProvider } from "./thirdparty";
import type { PriceProvider } from "./types";

/** env PRICE_PROVIDER'a göre sağlayıcı seç. */
export function getProvider(): PriceProvider {
  if (config.provider === "thirdparty") {
    return new ThirdPartyProvider(config.thirdpartyApiKey);
  }
  return new SteamDirectProvider(config.appId, config.currency);
}

export * from "./types";
