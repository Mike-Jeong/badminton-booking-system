"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** 예약일 상세에서 월 멤버 자동 배정을 수동으로 재실행한다(requirements.md 6번, 재실행 안전). */
export function ApplyMonthlyMembersButton({ bookingDayId }: { bookingDayId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ createdCount: number; skippedCount: number } | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/booking-days/${bookingDayId}/apply-monthly-members`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "자동 배정에 실패했습니다.");
        return;
      }
      setResult(json.data);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" disabled={loading} onClick={handleClick}>
        {loading ? "배정 중..." : "월 멤버 자동 배정"}
      </Button>
      {result && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          생성 {result.createdCount}건 · 스킵 {result.skippedCount}건
        </p>
      )}
      {error && (
        <p role="alert" aria-live="assertive" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
