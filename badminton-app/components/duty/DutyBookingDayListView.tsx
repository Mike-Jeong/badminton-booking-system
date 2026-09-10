"use client";

import { useState } from "react";
import Link from "next/link";
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

export interface DutyBookingDayRow {
  id: string;
  /** "YYYY-MM-DD" (Pacific/Auckland 기준으로 서버에서 이미 변환된 값) */
  date: string;
  dayOfWeekLabel: string;
  label: string | null;
  startTime: string;
  endTime: string;
  location: string;
  totalSlots: number;
  annualSlots: number;
  casualSlots: number;
  slotMode: "SEPARATED" | "COMBINED";
  isOpen: boolean;
}

/**
 * 듀티 담당자용 예약일 목록(requirements.md 28.5번, 읽기 전용).
 * 날짜 필터 기본값은 "오늘부터 미래"(from=오늘, to=무제한)이며, "필터 초기화"로 기본값으로
 * 되돌릴 수 있다 — CancelLookup(components/public/CancelLookup.tsx)의 날짜 필터 UX를
 * 그대로 따랐다(decisions.md D-24). 필터링은 서버가 아니라 클라이언트에서 처리한다.
 */
export function DutyBookingDayListView({
  bookingDays,
  today,
}: {
  bookingDays: DutyBookingDayRow[];
  /** 서버에서 계산한 Pacific/Auckland 기준 오늘 날짜("YYYY-MM-DD"). 필터 기본값. */
  today: string;
}) {
  const defaultFrom = today;
  const defaultTo = "";
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const filtered = bookingDays.filter(
    (bd) => (!fromDate || bd.date >= fromDate) && (!toDate || bd.date <= toDate)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>내 듀티 예약일 ({filtered.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bookingDays.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor="duty-filter-from">시작 날짜</Label>
              <Input
                id="duty-filter-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="duty-filter-to">종료 날짜</Label>
              <Input
                id="duty-filter-to"
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
                필터 초기화
              </Button>
            )}
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>요일</TableHead>
              <TableHead>라벨</TableHead>
              <TableHead>시간</TableHead>
              <TableHead>장소</TableHead>
              <TableHead>슬롯</TableHead>
              <TableHead>공개</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookingDays.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  배정된 예약일이 없습니다.
                </TableCell>
              </TableRow>
            )}
            {bookingDays.length > 0 && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  선택한 기간에 해당하는 예약일이 없습니다.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((bd) => (
              <TableRow key={bd.id}>
                <TableCell>
                  <Link
                    href={`/duty/booking-days/${bd.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {bd.date}
                  </Link>
                </TableCell>
                <TableCell>{bd.dayOfWeekLabel}</TableCell>
                <TableCell>{bd.label ?? "-"}</TableCell>
                <TableCell>
                  {bd.startTime} ~ {bd.endTime}
                </TableCell>
                <TableCell>{bd.location}</TableCell>
                <TableCell>
                  {bd.slotMode === "SEPARATED"
                    ? `연 ${bd.annualSlots} + 캐 ${bd.casualSlots} = ${bd.totalSlots}`
                    : `${bd.totalSlots}`}
                </TableCell>
                <TableCell>
                  {bd.isOpen ? <Badge>공개</Badge> : <Badge variant="secondary">비공개</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
