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
import {
  addDaysToDateOnly,
  formatDateOnlyInTimeZone,
  getTodayDateOnlyInTimeZone,
  isBookingDayEnded,
} from "@/lib/timezone";
import { useLocale } from "@/lib/i18n/LanguageContext";
import { dictionary, translateApiErrorMessage } from "@/lib/i18n/dictionary";

interface LookupBooking {
  id: string;
  name: string;
  status: "WAITING" | "CONFIRMED" | "CANCELLED";
  createdAt: string;
  cancelledAt: string | null;
  bookingDay: { id: string; date: string; label: string | null; location: string; endTime: string };
}

const DEFAULT_FILTER_RANGE_DAYS = 7;

/**
 * 예약 취소 2단계 플로우(requirements.md 14번, decisions.md D-03):
 * 전화번호로 목록 조회 -> bookingId 선택 -> 취소.
 */
export function CancelLookup() {
  const { locale } = useLocale();
  const t = dictionary[locale].lookup;
  const defaultFrom = getTodayDateOnlyInTimeZone();
  const defaultTo = addDaysToDateOnly(defaultFrom, DEFAULT_FILTER_RANGE_DAYS);
  const [phone, setPhone] = useState("");
  const [bookings, setBookings] = useState<LookupBooking[] | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

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
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      {t.empty}
                    </TableCell>
                  </TableRow>
                )}
                {bookings.length > 0 && filteredBookings?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
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
