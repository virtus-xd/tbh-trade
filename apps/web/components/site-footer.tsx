import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("Common");
  return (
    <footer className="mt-16 border-t border-neutral-900">
      <div className="mx-auto max-w-5xl px-6 py-8 text-xs text-neutral-600">
        <div className="mb-3 flex flex-wrap gap-4">
          <Link href="/methodology" className="hover:text-neutral-300">
            {t("nav.methodology")}
          </Link>
          <Link href="/opportunities" className="hover:text-neutral-300">
            {t("nav.opportunities")}
          </Link>
          <Link href="/status" className="hover:text-neutral-300">
            {t("nav.status")}
          </Link>
        </div>
        <p className="max-w-2xl leading-relaxed">{t("disclaimer")}</p>
      </div>
    </footer>
  );
}
