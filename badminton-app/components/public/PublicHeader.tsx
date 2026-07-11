"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LanguageContext";
import { dictionary } from "@/lib/i18n/dictionary";

export function PublicHeader() {
  const { locale, toggleLocale } = useLocale();
  const t = dictionary[locale].nav;

  return (
    <header className="border-b">
      <div className="container flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-semibold">
          {t.siteTitle}
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/lookup" className="text-sm text-muted-foreground hover:underline">
            {t.lookupLink}
          </Link>
          <button
            type="button"
            onClick={toggleLocale}
            className="rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            {locale === "ko" ? "English" : "한국어"}
          </button>
        </div>
      </div>
    </header>
  );
}
