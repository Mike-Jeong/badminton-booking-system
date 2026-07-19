"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AttendanceBadge } from "@/components/admin/AttendanceBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface AdminBookingRow {
  id: string;
  name: string;
  phone: string;
  memberType: "ANNUAL" | "CASUAL";
  status: "WAITING" | "CONFIRMED" | "CANCELLED";
  source: "USER" | "ADMIN" | "MONTHLY_MEMBER_AUTO";
  checkedInAt: string | Date | null;
  checkedOutAt: string | Date | null;
}

const STATUS_LABEL: Record<AdminBookingRow["status"], string> = {
  CONFIRMED: "확정",
  WAITING: "대기",
  CANCELLED: "취소됨",
};

const SOURCE_LABEL: Record<AdminBookingRow["source"], string> = {
  USER: "사용자",
  ADMIN: "관리자",
  MONTHLY_MEMBER_AUTO: "월멤버 자동",
};

/**
 * 관리자 예약 운영 패널(requirements.md 15번, roadmap.md Phase 3):
 * 예약자 전체 목록 + 대기 승인 + 취소 처리 + 수동 예약 추가.
 */
export function AdminBookingsPanel({
  bookingDayId,
  bookings,
}: {
  bookingDayId: string;
  bookings: AdminBookingRow[];
}) {
  const router = useRouter();
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const [addForm, setAddForm] = useState({ name: "", phone: "" });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  async function handleApprove(id: string) {
    setRowLoadingId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMED" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: json?.error?.message ?? "승인에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm("이 예약을 취소 처리하시겠습니까?")) return;
    setRowLoadingId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/bookings/${id}/cancel`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: json?.error?.message ?? "취소에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleCheckIn(id: string) {
    setRowLoadingId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/bookings/${id}/check-in`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: json?.error?.message ?? "입장 처리에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleCheckOut(id: string) {
    setRowLoadingId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/bookings/${id}/check-out`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: json?.error?.message ?? "퇴장 처리에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleResetCheckIn(id: string) {
    if (!window.confirm("입장/퇴장 처리를 초기화하시겠습니까?")) return;
    setRowLoadingId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/bookings/${id}/check-in`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: json?.error?.message ?? "초기화에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleAddSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingDayId, name: addForm.name, phone: addForm.phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddError(json?.error?.message ?? "예약 추가에 실패했습니다.");
        return;
      }
      setAddForm({ name: "", phone: "" });
      router.refresh();
    } catch {
      setAddError("네트워크 오류가 발생했습니다.");
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>예약자 목록 ({bookings.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>전화번호</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>출석</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  아직 예약자가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.phone}</TableCell>
                <TableCell>{b.memberType === "ANNUAL" ? "연 멤버" : "캐주얼"}</TableCell>
                <TableCell>
                  <Badge variant={b.status === "CONFIRMED" ? "default" : "secondary"}>
                    {STATUS_LABEL[b.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{SOURCE_LABEL[b.source]}</TableCell>
                <TableCell>
                  {b.status === "CONFIRMED" ? (
                    <AttendanceBadge checkedInAt={b.checkedInAt} checkedOutAt={b.checkedOutAt} />
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {b.status !== "CANCELLED" && (
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex flex-wrap gap-2">
                        {b.status === "WAITING" && (
                          <Button
                            size="sm"
                            disabled={rowLoadingId === b.id}
                            onClick={() => handleApprove(b.id)}
                          >
                            승인
                          </Button>
                        )}
                        {b.status === "CONFIRMED" && !b.checkedInAt && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowLoadingId === b.id}
                            onClick={() => handleCheckIn(b.id)}
                          >
                            입장 처리
                          </Button>
                        )}
                        {b.status === "CONFIRMED" && b.checkedInAt && !b.checkedOutAt && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowLoadingId === b.id}
                            onClick={() => handleCheckOut(b.id)}
                          >
                            퇴장 처리
                          </Button>
                        )}
                        {b.status === "CONFIRMED" && b.checkedInAt && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowLoadingId === b.id}
                            onClick={() => handleResetCheckIn(b.id)}
                          >
                            초기화
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={rowLoadingId === b.id}
                          onClick={() => handleCancel(b.id)}
                        >
                          취소
                        </Button>
                      </div>
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

        <div className="border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">관리자 수동 예약 추가</h3>
          <form onSubmit={handleAddSubmit} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="admin-add-name">이름</Label>
              <Input
                id="admin-add-name"
                value={addForm.name}
                onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="admin-add-phone">전화번호</Label>
              <Input
                id="admin-add-phone"
                value={addForm.phone}
                onChange={(e) => setAddForm((prev) => ({ ...prev, phone: e.target.value }))}
                required
              />
            </div>
            <Button type="submit" disabled={addLoading}>
              {addLoading ? "추가 중..." : "추가"}
            </Button>
          </form>
          {addError && (
            <p role="alert" aria-live="assertive" className="mt-2 text-sm text-destructive">
              {addError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
