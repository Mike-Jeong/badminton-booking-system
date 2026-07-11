"use client";

import { CancelLookup } from "@/components/public/CancelLookup";
import { useLocale } from "@/lib/i18n/LanguageContext";
import { dictionary } from "@/lib/i18n/dictionary";

export default function LookupPage() {
  const { locale } = useLocale();
  const t = dictionary[locale].lookup;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{t.heading}</h2>
        <p className="text-sm text-muted-foreground">{t.subheading}</p>
      </div>
      <CancelLookup />
    </div>
  );
}
