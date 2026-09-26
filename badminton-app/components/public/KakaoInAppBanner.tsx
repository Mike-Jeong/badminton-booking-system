"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/LanguageContext";
import { dictionary } from "@/lib/i18n/dictionary";
import { isKakaoInAppBrowser, openInExternalBrowser } from "@/lib/inAppBrowser";

/**
 * 카카오톡 인앱 브라우저에서 열렸을 때만 보이는 안내 배너(decisions.md D-40).
 * userAgent 검사는 마운트 후에만 수행한다 — 서버 렌더 결과와 어긋나지 않게 초기 렌더는 항상 null.
 * 자동 리다이렉트는 하지 않고, 사용자가 버튼을 눌렀을 때만 외부 브라우저로 넘긴다.
 */
export function KakaoInAppBanner() {
  const { locale } = useLocale();
  const t = dictionary[locale].inApp;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isKakaoInAppBrowser(navigator.userAgent)) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="border-b bg-accent">
      <div className="container flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-3">
        <p className="flex-1 text-sm">{t.kakaoWarning}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openInExternalBrowser(window.location.href)}
          >
            {t.openExternal}
          </Button>
          <button
            type="button"
            aria-label={t.dismiss}
            onClick={() => setShow(false)}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-background"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
