"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateOnlyInTimeZone } from "@/lib/timezone";

interface LookupBooking {
  id: string;
  name: string;
  status: "WAITING" | "CONFIRMED" | "CANCELLED";
  createdAt: string;
  cancelledAt: string | null;
  bookingDay: { id: string; date: string; label: string | null; location: string };
}

const STATUS_LABEL: Record<LookupBooking["status"], string> = {
  CONFIRMED: "확정",
  WAITING: "대기",
  CANCELLED: "취소됨",
};

/**
 * 예약 취소 2단계 플로우(requirements.md 14번, decisions.md D-03):
 * 전화번호로 목록 조회 -> bookingId 선택 -> 취소.
 */
export function CancelLookup() {
  const [phone, setPhone] = useState("");
  const [bookings, setBookings] = useState<LookupBooking[] | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLookupError(null);
    setLookupLoading(true);
    try {
      const res = await fetch("/api/bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLookupError(json?.error?.message ?? "조회에 실패했습니다.");
        setBookings(null);
        return;
      }
      setBookings(json.data);
    } catch {
      setLookupError("네트워크 오류가 발생했습니다.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleCancel(bookingId: string) {
    if (!window.confirm("이 예약을 취소하시겠습니까?")) return;
    setCancellingId(bookingId);
    setRowError((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [bookingId]: json?.error?.message ?? "취소에 실패했습니다." }));
        return;
      }
      setBookings(
        (prev) =>
          prev?.map((b) => (b.id === bookingId ? { ...b, status: "CANCELLED" as const } : b)) ?? null
      );
    } catch {
      setRowError((prev) => ({ ...prev, [bookingId]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>내 예약 조회</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLookup} className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="lookup-phone">전화번호</Label>
              <Input
                id="lookup-phone"
                type="tel"
                placeholder="010-1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={lookupLoading}>
              {lookupLoading ? "조회 중..." : "조회"}
            </Button>
          </form>
          {lookupError && (
            <p role="alert" aria-live="assertive" className="mt-2 text-sm text-destructive">
              {lookupError}
            </p>
          )}
        </CardContent>
      </Card>

      {bookings && (
        <Card>
          <CardHeader>
            <CardTitle>조회 결과 ({bookings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      이 전화번호로 등록된 예약이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {formatDateOnlyInTimeZone(new Date(b.bookingDay.date))}
                      {b.bookingDay.label ? ` · ${b.bookingDay.label}` : ""}
                      <div className="text-xs text-muted-foreground">{b.bookingDay.location}</div>
                    </TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === "CONFIRMED" ? "default" : "secondary"}>
                        {STATUS_LABEL[b.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {b.status !== "CANCELLED" && (
                        <div className="space-y-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={cancellingId === b.id}
                            onClick={() => handleCancel(b.id)}
                          >
                            {cancellingId === b.id ? "취소 중..." : "취소"}
                          </Button>
                          {rowError[b.id] && (
                            <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                              {rowError[b.id]}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
