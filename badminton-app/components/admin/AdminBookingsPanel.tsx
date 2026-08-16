"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import { compressImageFile } from "@/lib/imageCompression";

export interface AdminBookingRow {
  id: string;
  name: string;
  phone: string;
  memberType: "ANNUAL" | "CASUAL";
  status: "WAITING" | "CONFIRMED" | "CANCELLED";
  source: "USER" | "ADMIN" | "MONTHLY_MEMBER_AUTO";
  paymentConfirmationRequired: boolean;
  paymentConfirmed: boolean;
  hasPaymentProof: boolean;
  paymentAmountDue: number;
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
 * 관리자 예약 운영 패널(requirements.md 15·26번, roadmap.md Phase 3):
 * 예약자 전체 목록 + 대기 승인 + 취소 처리 + 수동 예약 추가 + 결제 확인(상태 배지/이미지
 * 보기/대리 업로드/확인·확인취소). 관리자 화면은 다국어 사전을 쓰지 않는다(decisions.md D-18).
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

  const [paymentError, setPaymentError] = useState<Record<string, string>>({});
  const [paymentUploadingId, setPaymentUploadingId] = useState<string | null>(null);
  const [paymentConfirmingId, setPaymentConfirmingId] = useState<string | null>(null);
  const [imageVisible, setImageVisible] = useState<Record<string, boolean>>({});
  const [imageLoadingId, setImageLoadingId] = useState<string | null>(null);
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

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

  async function handleToggleImage(bookingId: string) {
    const nextVisible = !imageVisible[bookingId];
    setImageVisible((prev) => ({ ...prev, [bookingId]: nextVisible }));
    if (!nextVisible || imageDataUrls[bookingId]) return;

    setImageLoadingId(bookingId);
    setPaymentError((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/payment-proof`);
      const json = await res.json();
      if (!res.ok) {
        setPaymentError((prev) => ({ ...prev, [bookingId]: json?.error?.message ?? "이미지를 불러오지 못했습니다." }));
        return;
      }
      setImageDataUrls((prev) => ({ ...prev, [bookingId]: json.data.imageDataUrl }));
    } catch {
      setPaymentError((prev) => ({ ...prev, [bookingId]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setImageLoadingId(null);
    }
  }

  async function handleAdminUpload(bookingId: string, file: File) {
    setPaymentUploadingId(bookingId);
    setPaymentError((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      const compressed = await compressImageFile(file);
      const formData = new FormData();
      formData.append("file", compressed);
      const res = await fetch(`/api/admin/bookings/${bookingId}/payment-proof`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setPaymentError((prev) => ({ ...prev, [bookingId]: json?.error?.message ?? "업로드에 실패했습니다." }));
        return;
      }
      setImageDataUrls((prev) => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      setImageVisible((prev) => ({ ...prev, [bookingId]: false }));
      router.refresh();
    } catch {
      setPaymentError((prev) => ({ ...prev, [bookingId]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setPaymentUploadingId(null);
    }
  }

  async function handleSetConfirmation(bookingId: string, confirmed: boolean) {
    setPaymentConfirmingId(bookingId);
    setPaymentError((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/payment-confirmation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPaymentError((prev) => ({ ...prev, [bookingId]: json?.error?.message ?? "처리에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setPaymentError((prev) => ({ ...prev, [bookingId]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setPaymentConfirmingId(null);
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
              <TableHead>결제확인</TableHead>
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
                <TableCell className={b.status === "CANCELLED" ? "line-through text-muted-foreground" : undefined}>
                  {b.name}
                </TableCell>
                <TableCell>{b.phone}</TableCell>
                <TableCell>{b.memberType === "ANNUAL" ? "연 멤버" : "캐주얼"}</TableCell>
                <TableCell>
                  <Badge variant={b.status === "CONFIRMED" ? "default" : "secondary"}>
                    {STATUS_LABEL[b.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{SOURCE_LABEL[b.source]}</TableCell>
                <TableCell>
                  {b.status === "CONFIRMED" && (
                    <div className="space-y-1">
                      {!b.paymentConfirmationRequired ? (
                        <Badge variant="secondary">면제</Badge>
                      ) : (
                        <>
                          <Badge variant={b.paymentConfirmed ? "default" : "secondary"}>
                            {b.paymentConfirmed ? "확인됨" : b.hasPaymentProof ? "확인 대기" : "미확인"}
                          </Badge>
                          {b.paymentAmountDue > 0 && (
                            <p className="text-xs text-muted-foreground">입금 금액 ${b.paymentAmountDue}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {b.hasPaymentProof && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={imageLoadingId === b.id}
                                onClick={() => handleToggleImage(b.id)}
                              >
                                {imageLoadingId === b.id
                                  ? "불러오는 중..."
                                  : imageVisible[b.id]
                                    ? "이미지 숨기기"
                                    : "이미지 보기"}
                              </Button>
                            )}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              ref={(el) => {
                                if (el) fileInputRefs.current.set(b.id, el);
                                else fileInputRefs.current.delete(b.id);
                              }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) void handleAdminUpload(b.id, file);
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={paymentUploadingId === b.id}
                              onClick={() => fileInputRefs.current.get(b.id)?.click()}
                            >
                              {paymentUploadingId === b.id ? "업로드 중..." : "대리 업로드"}
                            </Button>
                            {b.paymentConfirmed ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={paymentConfirmingId === b.id}
                                onClick={() => handleSetConfirmation(b.id, false)}
                              >
                                확인 취소
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                disabled={paymentConfirmingId === b.id}
                                onClick={() => handleSetConfirmation(b.id, true)}
                              >
                                결제 확인
                              </Button>
                            )}
                          </div>
                          {imageVisible[b.id] && imageDataUrls[b.id] && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageDataUrls[b.id]}
                              alt="결제 증빙"
                              className="mt-1 max-h-48 max-w-[200px] rounded border object-contain"
                            />
                          )}
                          {paymentError[b.id] && (
                            <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                              {paymentError[b.id]}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {b.status !== "CANCELLED" && (
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex gap-2">
                        {b.status === "WAITING" && (
                          <Button
                            size="sm"
                            disabled={rowLoadingId === b.id}
                            onClick={() => handleApprove(b.id)}
                          >
                            승인
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
