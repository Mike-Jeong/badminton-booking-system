"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/i18n/LanguageContext";
import { dictionary, translateApiErrorMessage } from "@/lib/i18n/dictionary";
import { ParticipantQrButton } from "@/components/public/ParticipantQrButton";
import { loadSavedIdentity, saveIdentity } from "@/lib/localBookingIdentity";

export function BookingForm({ bookingDayId, ended = false }: { bookingDayId: string; ended?: boolean }) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = dictionary[locale].form;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<"CONFIRMED" | "WAITING" | null>(null);
  // 방금 신청한 예약의 참여자 영구 식별 코드(requirements.md 27.4번). 백필 전 과도기 등으로
  // 값이 없으면 QR 버튼을 노출하지 않는다(architecture.md 4장 방어적 처리).
  const [participantCode, setParticipantCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 마지막으로 입력했던 이름/전화번호 자동 채우기(브라우저 저장, lib/localBookingIdentity.ts).
  // SSR과의 하이드레이션 불일치를 피하려고 초기 렌더는 빈 값으로 두고 마운트 후에만 채운다.
  useEffect(() => {
    const saved = loadSavedIdentity();
    if (saved.name) setName(saved.name);
    if (saved.phone) setPhone(saved.phone);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setParticipantCode(null);
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingDayId, name, phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ? translateApiErrorMessage(locale, json.error.message) : t.fallbackError);
        return;
      }
      setResult(json.data.status);
      setParticipantCode(typeof json.data.participantCode === "string" ? json.data.participantCode : null);
      saveIdentity({ name, phone });
      setName("");
      setPhone("");
      router.refresh();
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  }

  if (ended) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.endedMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="booking-name">{t.name}</Label>
            <Input
              id="booking-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="booking-phone">{t.phone}</Label>
            <Input
              id="booking-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t.phonePlaceholder}
              autoComplete="tel"
              required
            />
          </div>

          {result === "CONFIRMED" && (
            <p aria-live="polite" className="text-sm font-medium text-primary">
              {t.resultConfirmed}
            </p>
          )}
          {result === "WAITING" && (
            <p aria-live="polite" className="text-sm font-medium text-muted-foreground">
              {t.resultWaiting}
            </p>
          )}
          {result && participantCode && (
            <div className="space-y-1 rounded-md border p-3">
              <p className="text-sm text-muted-foreground">{t.qrGuide}</p>
              <ParticipantQrButton code={participantCode} size="sm" />
            </div>
          )}
          {error && (
            <p role="alert" aria-live="assertive" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? t.submitting : t.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
