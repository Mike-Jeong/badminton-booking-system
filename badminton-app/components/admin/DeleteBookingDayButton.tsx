"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeleteBookingDayButton({ id, bookingCount }: { id: string; bookingCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      bookingCount > 0
        ? `이 예약일에는 ${bookingCount}건의 예약이 연결되어 있습니다. 정말 삭제하시겠습니까?`
        : "이 예약일을 삭제하시겠습니까?"
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/booking-days/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "삭제에 실패했습니다.");
        return;
      }
      router.push("/admin/booking-days");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="destructive" onClick={handleDelete} disabled={loading}>
        {loading ? "삭제 중..." : "예약일 삭제"}
      </Button>
      {error && (
        <p role="alert" aria-live="assertive" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
