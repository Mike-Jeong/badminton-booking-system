"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateOnlyInTimeZone, getDayOfWeekLabel, isBookingDayEnded } from "@/lib/timezone";
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

export function BookingDayListView({ bookingDays }: { bookingDays: BookingDayListItem[] }) {
  const { locale } = useLocale();
  const t = dictionary[locale].list;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{t.heading}</h2>
        <p className="text-sm text-muted-foreground">{t.subheading}</p>
      </div>

      {bookingDays.length === 0 && <p className="text-muted-foreground">{t.empty}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bookingDays.map((bd) => (
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
