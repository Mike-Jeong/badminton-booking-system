"use client";

import { useEffect, useRef, useState } from "react";
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
import { formatDateOnlyInTimeZone, getTodayDateOnlyInTimeZone, isBookingDayEnded } from "@/lib/timezone";
import { useLocale } from "@/lib/i18n/LanguageContext";
import { dictionary, translateApiErrorMessage } from "@/lib/i18n/dictionary";
import { compressImageFile } from "@/lib/imageCompression";
import { ParticipantQrButton } from "@/components/public/ParticipantQrButton";
import { loadSavedIdentity, saveIdentity } from "@/lib/localBookingIdentity";

interface LookupBooking {
  id: string;
  name: string;
  status: "WAITING" | "CONFIRMED" | "CANCELLED";
  createdAt: string;
  cancelledAt: string | null;
  /** 참여자 영구 식별 코드(requirements.md 27.4번). 백필 전 과도기에는 null일 수 있다. */
  participantCode: string | null;
  bookingDay: { id: string; date: string; label: string | null; location: string; endTime: string };
  paymentConfirmationRequired: boolean;
  paymentConfirmed: boolean;
  hasPaymentProof: boolean;
  paymentAmountDue: number;
}

/**
 * 예약 취소 2단계 플로우(requirements.md 14번, decisions.md D-03):
 * 전화번호로 목록 조회 -> bookingId 선택 -> 취소.
 *
 * 날짜 필터 기본값은 "오늘 이후만"(fromDate=오늘, toDate=무제한)이다. 이 화면은 "이번 주에
 * 뭐가 있나 훑어보기"가 아니라 "내 특정 예약을 찾아 취소하기"가 목적이라, 지난 예약만
 * 기본으로 가려주고 미래 쪽은 아무리 멀어도 항상 보이게 한다(decisions.md D-24 개정).
 */
export function CancelLookup() {
  const { locale } = useLocale();
  const t = dictionary[locale].lookup;
  const defaultFrom = getTodayDateOnlyInTimeZone();
  const defaultTo = "";
  const [phone, setPhone] = useState("");
  const [bookings, setBookings] = useState<LookupBooking[] | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<Record<string, { text: string; isError: boolean }>>({});
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // 마지막으로 조회/예약했던 전화번호 자동 채우기(BookingForm과 공유, lib/localBookingIdentity.ts).
  // 하이드레이션 불일치를 피하려고 마운트 후에만 채운다.
  useEffect(() => {
    const saved = loadSavedIdentity();
    if (saved.phone) setPhone(saved.phone);
  }, []);

  const filteredBookings =
    bookings?.filter((b) => {
      const dateOnly = formatDateOnlyInTimeZone(new Date(b.bookingDay.date));
      return (!fromDate || dateOnly >= fromDate) && (!toDate || dateOnly <= toDate);
    }) ?? null;

  async function handleLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLookupError(null);
    setFromDate(defaultFrom);
    setToDate(defaultTo);
    setLookupLoading(true);
    try {
      const res = await fetch("/api/bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLookupError(json?.error?.message ? translateApiErrorMessage(locale, json.error.message) : t.fallbackError);
        setBookings(null);
        return;
      }
      setBookings(json.data);
      saveIdentity({ phone });
    } catch {
      setLookupError(t.networkError);
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleCancel(bookingId: string) {
    if (!window.confirm(t.confirmDialog)) return;
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
        setRowError((prev) => ({
          ...prev,
          [bookingId]: json?.error?.message
            ? translateApiErrorMessage(locale, json.error.message)
            : t.cancelFallbackError,
        }));
        return;
      }
      setBookings(
        (prev) =>
          prev?.map((b) => (b.id === bookingId ? { ...b, status: "CANCELLED" as const } : b)) ?? null
      );
    } catch {
      setRowError((prev) => ({ ...prev, [bookingId]: t.networkError }));
    } finally {
      setCancellingId(null);
    }
  }

  async function handleUploadFile(bookingId: string, file: File) {
    setUploadingId(bookingId);
    setPaymentMessage((prev) => ({ ...prev, [bookingId]: { text: "", isError: false } }));
    try {
      const compressed = await compressImageFile(file);
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("phone", phone);

      const res = await fetch(`/api/bookings/${bookingId}/payment-proof`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setPaymentMessage((prev) => ({
          ...prev,
          [bookingId]: {
            text: json?.error?.message
              ? translateApiErrorMessage(locale, json.error.message)
              : t.paymentUploadFallbackError,
            isError: true,
          },
        }));
        return;
      }
      setBookings(
        (prev) => prev?.map((b) => (b.id === bookingId ? { ...b, hasPaymentProof: true } : b)) ?? null
      );
      setPaymentMessage((prev) => ({
        ...prev,
        [bookingId]: { text: t.paymentUploadSuccess, isError: false },
      }));
    } catch {
      setPaymentMessage((prev) => ({ ...prev, [bookingId]: { text: t.networkError, isError: true } }));
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.cardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLookup} className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="lookup-phone">{t.phone}</Label>
              <Input
                id="lookup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.phonePlaceholder}
                autoComplete="tel"
                required
              />
            </div>
            <Button type="submit" disabled={lookupLoading}>
              {lookupLoading ? t.searching : t.search}
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
            <CardTitle>{t.resultTitle(filteredBookings?.length ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bookings.length > 0 && (
              <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                <div className="space-y-1">
                  <Label htmlFor="cancel-filter-from">{t.filterFrom}</Label>
                  <Input
                    id="cancel-filter-from"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cancel-filter-to">{t.filterTo}</Label>
                  <Input
                    id="cancel-filter-to"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                {(fromDate !== defaultFrom || toDate !== defaultTo) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFromDate(defaultFrom);
                      setToDate(defaultTo);
                    }}
                  >
                    {t.filterReset}
                  </Button>
                )}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.date}</TableHead>
                  <TableHead>{t.name}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.payment}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      {t.empty}
                    </TableCell>
                  </TableRow>
                )}
                {bookings.length > 0 && filteredBookings?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      {t.emptyFiltered}
                    </TableCell>
                  </TableRow>
                )}
                {filteredBookings?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {formatDateOnlyInTimeZone(new Date(b.bookingDay.date))}
                      {b.bookingDay.label ? ` · ${b.bookingDay.label}` : ""}
                      <div className="text-xs text-muted-foreground">{b.bookingDay.location}</div>
                    </TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === "CONFIRMED" ? "default" : "secondary"}>
                        {t.statusLabel[b.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {b.status === "CONFIRMED" && (
                        <div className="space-y-1">
                          {!b.paymentConfirmationRequired ? (
                            <Badge variant="secondary">{t.paymentExempt}</Badge>
                          ) : (
                            <>
                              <Badge variant={b.paymentConfirmed ? "default" : "secondary"}>
                                {b.paymentConfirmed
                                  ? t.paymentConfirmed
                                  : b.hasPaymentProof
                                    ? t.paymentAwaitingConfirmation
                                    : t.paymentUnconfirmed}
                              </Badge>
                              {b.paymentAmountDue > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {t.paymentAmountDue(b.paymentAmountDue)}
                                </p>
                              )}
                              {!b.paymentConfirmed && (
                                <div>
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
                                      if (file) void handleUploadFile(b.id, file);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={uploadingId === b.id}
                                    onClick={() => fileInputRefs.current.get(b.id)?.click()}
                                  >
                                    {uploadingId === b.id ? t.paymentUploading : t.paymentUpload}
                                  </Button>
                                </div>
                              )}
                              {paymentMessage[b.id]?.text && (
                                <p
                                  role="alert"
                                  aria-live="assertive"
                                  className={`text-xs ${paymentMessage[b.id].isError ? "text-destructive" : "text-muted-foreground"}`}
                                >
                                  {paymentMessage[b.id].text}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {/* 참여자 영구 식별 코드 QR(requirements.md 27.4번). 코드가 없으면(백필 전
                            과도기) 버튼 자체를 숨긴다. 취소된 예약에도 코드는 사람에 귀속되므로 노출한다. */}
                        {b.participantCode && <ParticipantQrButton code={b.participantCode} size="sm" />}
                        {b.status !== "CANCELLED" &&
                          (isBookingDayEnded(new Date(b.bookingDay.date), b.bookingDay.endTime) ? (
                            <p className="text-xs text-muted-foreground">{t.endedNote}</p>
                          ) : (
                            <div className="space-y-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={cancellingId === b.id}
                                onClick={() => handleCancel(b.id)}
                              >
                                {cancellingId === b.id ? t.cancelling : t.cancel}
                              </Button>
                              {rowError[b.id] && (
                                <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                                  {rowError[b.id]}
                                </p>
                              )}
                            </div>
                          ))}
                      </div>
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
