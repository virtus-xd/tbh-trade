import { defineRouting } from "next-intl/routing";

/**
 * i18n yönlendirme — EN birincil (öneksiz: /synthesis), TR önekli (/tr/synthesis).
 * `as-needed`: varsayılan locale URL'de önek almaz → temiz kanonik URL'ler (SEO).
 */
export const routing = defineRouting({
  locales: ["en", "tr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
