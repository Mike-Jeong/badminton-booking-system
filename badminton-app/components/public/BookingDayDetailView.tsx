"use client";

import Link from "next/link";
import { BookingForm } from "@/components/public/BookingForm";
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
import { formatDateOnlyInTimeZone, getDayOfWeekLabel, isBookingDayEnded } from "@/lib/timezone";
import { useLocale } from "@/lib/i18n/LanguageContext";
import { dictionary, formatSlotSummary, formatConfirmedWaiting } from "@/lib/i18n/dictionary";

interface BookingItem {
  id: string;
  name: string;
  status: "CONFIRMED" | "WAITING" | "CANCELLED";
  memberType: "ANNUAL" | "CASUAL";
}

interface BookingDayDetail {
  id: string;
  date: Date;
  dayOfWeek: number;
  label: string | null;
  startTime: string;
  endTime: string;
  location: string;
  dutyPerson: string;
  slotMode: "SEPARATED" | "COMBINED";
  annualSlots: number;
  casualSlots: number;
  totalSlots: number;
  bookings: BookingItem[];
}

export function BookingDayDetailView({ bookingDay }: { bookingDay: BookingDayDetail }) {
  const { locale } = useLocale();
  const t = dictionary[locale].detail;

  const confirmed = bookingDay.bookings.filter((b) => b.status === "CONFIRMED");
  const waiting = bookingDay.bookings.filter((b) => b.status === "WAITING");
  const confirmedAnnual = confirmed.filter((b) => b.memberType === "ANNUAL").length;
  const confirmedCasual = confirmed.filter((b) => b.memberType === "CASUAL").length;
  const waitingAnnual = waiting.filter((b) => b.memberType === "ANNUAL").length;
  const waitingCasual = waiting.filter((b) => b.memberType === "CASUAL").length;
  const ended = isBookingDayEnded(new Date(bookingDay.date), bookingDay.endTime);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          {t.back}
        </Link>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
          <span>
            {formatDateOnlyInTimeZone(new Date(bookingDay.date))} ({getDayOfWeekLabel(bookingDay.dayOfWeek, locale)})
            {bookingDay.label ? ` · ${bookingDay.label}` : ""}
          </span>
          {ended && (
            <Badge variant="secondary" className="text-sm font-normal">
              {t.ended}
            </Badge>
          )}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.basicInfo}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">{t.time}</p>
            <p className="font-medium">
              {bookingDay.startTime} ~ {bookingDay.endTime}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.location}</p>
            <p className="font-medium">{bookingDay.location}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.dutyPerson}</p>
            <p className="font-medium">{bookingDay.dutyPerson}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.slots}</p>
            <p className="font-medium">
              {formatSlotSummary(
                locale,
                bookingDay.slotMode,
                bookingDay.annualSlots,
                bookingDay.casualSlots,
                bookingDay.totalSlots
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.confirmedWaiting}</p>
            <p className="whitespace-pre-line font-medium">
              {formatConfirmedWaiting(locale, bookingDay.slotMode, {
                confirmedAnnual,
                confirmedCasual,
                waitingAnnual,
                waitingCasual,
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      <BookingForm bookingDayId={bookingDay.id} ended={ended} />

      <Card>
        <CardHeader>
          <CardTitle>{t.rosterTitle(bookingDay.bookings.length)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.name}</TableHead>
                <TableHead>{t.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookingDay.bookings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                    {t.emptyRoster}
                  </TableCell>
                </TableRow>
              )}
              {bookingDay.bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>
                    {b.status === "CONFIRMED" ? (
                      <Badge>{t.confirmed}</Badge>
                    ) : (
                      <Badge variant="secondary">{t.waiting}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
