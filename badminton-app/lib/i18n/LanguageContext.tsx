"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/dictionary";

const STORAGE_KEY = "badminton-locale";

interface LanguageContextValue {
  locale: Locale;
  toggleLocale: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("ko");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ko" || stored === "en") {
      setLocale(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function toggleLocale() {
    setLocale((prev) => {
      const next: Locale = prev === "ko" ? "en" : "ko";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return <LanguageContext.Provider value={{ locale, toggleLocale }}>{children}</LanguageContext.Provider>;
}

export function useLocale(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLocale은 LanguageProvider 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
}
