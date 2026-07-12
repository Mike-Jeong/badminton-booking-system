"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDaysToDateOnly,
  formatDateOnlyInTimeZone,
  getDayOfWeekLabel,
  getTodayDateOnlyInTimeZone,
  isBookingDayEnded,
} from "@/lib/timezone";
import { useLocale } from "@/lib/i18n/LanguageContext";
import { dictionary, formatSlotSummary } from "@/lib/i18n/dictionary";

interface BookingDayListItem {
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
}

const DEFAULT_FILTER_RANGE_DAYS = 7;

export function BookingDayListView({ bookingDays }: { bookingDays: BookingDayListItem[] }) {
  const { locale } = useLocale();
  const t = dictionary[locale].list;
  const defaultFrom = getTodayDateOnlyInTimeZone();
  const defaultTo = addDaysToDateOnly(defaultFrom, DEFAULT_FILTER_RANGE_DAYS);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const filteredBookingDays = bookingDays.filter((bd) => {
    const dateOnly = formatDateOnlyInTimeZone(new Date(bd.date));
    return (!fromDate || dateOnly >= fromDate) && (!toDate || dateOnly <= toDate);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{t.heading}</h2>
        <p className="text-sm text-muted-foreground">{t.subheading}</p>
      </div>

      {bookingDays.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor="list-filter-from">{t.filterFrom}</Label>
            <Input
              id="list-filter-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="list-filter-to">{t.filterTo}</Label>
            <Input
              id="list-filter-to"
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

      {bookingDays.length === 0 && <p className="text-muted-foreground">{t.empty}</p>}
      {bookingDays.length > 0 && filteredBookingDays.length === 0 && (
        <p className="text-muted-foreground">{t.emptyFiltered}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredBookingDays.map((bd) => (
          <Link key={bd.id} href={`/booking-days/${bd.id}`}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-1 text-base">
                  <span>
                    {formatDateOnlyInTimeZone(new Date(bd.date))} ({getDayOfWeekLabel(bd.dayOfWeek, locale)})
                  </span>
                  <span className="flex items-center gap-1">
                    {isBookingDayEnded(new Date(bd.date), bd.endTime) && (
                      <Badge variant="secondary">{t.ended}</Badge>
                    )}
                    {bd.label && <Badge variant="secondary">{bd.label}</Badge>}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">{t.time}</span> {bd.startTime} ~ {bd.endTime}
                </p>
                <p>
                  <span className="text-muted-foreground">{t.location}</span> {bd.location}
                </p>
                <p>
                  <span className="text-muted-foreground">{t.duty}</span> {bd.dutyPerson}
                </p>
                <p>
                  <span className="text-muted-foreground">{t.slots}</span>{" "}
                  {formatSlotSummary(locale, bd.slotMode, bd.annualSlots, bd.casualSlots, bd.totalSlots)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
