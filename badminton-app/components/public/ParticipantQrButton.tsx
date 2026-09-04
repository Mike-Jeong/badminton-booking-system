"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/LanguageContext";
import { dictionary } from "@/lib/i18n/dictionary";

/**
 * 참여자 영구 식별 코드 QR 저장 버튼(requirements.md 27.4번, decisions.md D-33·D-35).
 * QR에는 code 값만 인코딩한다 — 이름/전화번호 등 어떤 정보도 담지 않는다.
 *
 * qrcode 패키지는 클릭 시점에 동적 임포트한다. QR을 저장하지 않는 대다수 방문자의 초기 JS
 * 번들에 영향을 주지 않기 위함이다(코드 스플리팅, decisions.md D-35).
 *
 * 예약 완료 화면(BookingForm)과 내 예약 조회 화면(CancelLookup) 양쪽에서 재사용한다.
 */
export function ParticipantQrButton({
  code,
  size = "default",
}: {
  code: string;
  size?: "default" | "sm";
}) {
  const { locale } = useLocale();
  const t = dictionary[locale].qr;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(code, { width: 300, margin: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `participant-qr-${code}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setError(t.downloadError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size={size} disabled={loading} onClick={handleDownload}>
        {loading ? t.saving : t.save}
      </Button>
      {error && (
        <p role="alert" aria-live="assertive" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
