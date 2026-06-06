import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import "../globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Home" });
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: "TBH Trade — Task Bar Hero Synthesis & Craft Profit Calculator",
      template: "%s",
    },
    description: t("tagline"),
    alternates: {
      canonical: "/",
      languages: { en: "/", tr: "/tr" },
    },
  };
}

export default async function LocaleLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        <NextIntlClientProvider>
          <SiteNav />
          {props.children}
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
