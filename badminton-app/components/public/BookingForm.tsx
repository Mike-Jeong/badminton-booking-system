"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BookingForm({ bookingDayId }: { bookingDayId: string }) {
  const router = useRouter();
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
        setError(json?.error?.message ?? "예약 신청에 실패했습니다.");
        return;
      }
      setResult(json.data.status);
      setName("");
      setPhone("");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>예약 신청</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="booking-name">이름</Label>
            <Input id="booking-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="booking-phone">전화번호</Label>
            <Input
              id="booking-phone"
              type="tel"
              placeholder="010-1234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          {result === "CONFIRMED" && (
            <p aria-live="polite" className="text-sm font-medium text-primary">
              예약이 확정되었습니다.
            </p>
          )}
          {result === "WAITING" && (
            <p aria-live="polite" className="text-sm font-medium text-muted-foreground">
              슬롯이 가득 차 대기 명단에 등록되었습니다.
            </p>
          )}
          {error && (
            <p role="alert" aria-live="assertive" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "신청 중..." : "예약 신청"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
