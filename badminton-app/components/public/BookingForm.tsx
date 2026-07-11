"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/i18n/LanguageContext";
import { dictionary, translateApiErrorMessage } from "@/lib/i18n/dictionary";

export function BookingForm({ bookingDayId }: { bookingDayId: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = dictionary[locale].form;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<"CONFIRMED" | "WAITING" | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
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
      setName("");
      setPhone("");
      router.refresh();
    } catch {
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
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
            <Input id="booking-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="booking-phone">{t.phone}</Label>
            <Input
              id="booking-phone"
              type="tel"
              placeholder={t.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
