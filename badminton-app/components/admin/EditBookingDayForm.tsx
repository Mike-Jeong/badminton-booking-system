"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SlotMode = "SEPARATED" | "COMBINED";

export interface EditableBookingDay {
  id: string;
  label: string | null;
  startTime: string;
  endTime: string;
  location: string;
  dutyPerson: string;
  totalSlots: number;
  annualSlots: number;
  casualSlots: number;
  slotMode: SlotMode;
  isOpen: boolean;
}

export function EditBookingDayForm({
  bookingDay,
  confirmedCount,
}: {
  bookingDay: EditableBookingDay;
  confirmedCount: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    label: bookingDay.label ?? "",
    startTime: bookingDay.startTime,
    endTime: bookingDay.endTime,
    location: bookingDay.location,
    dutyPerson: bookingDay.dutyPerson,
    totalSlots: String(bookingDay.totalSlots),
    annualSlots: String(bookingDay.annualSlots),
    casualSlots: String(bookingDay.casualSlots),
    slotMode: bookingDay.slotMode,
    isOpen: bookingDay.isOpen,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isSeparated = form.slotMode === "SEPARATED";
  const computedTotalSlots = Number(form.annualSlots || 0) + Number(form.casualSlots || 0);
  const totalSlotsNum = isSeparated ? computedTotalSlots : Number(form.totalSlots || 0);
  const showOverbookWarning = confirmedCount > totalSlotsNum;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/booking-days/${bookingDay.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label || null,
          startTime: form.startTime,
          endTime: form.endTime,
          location: form.location,
          dutyPerson: form.dutyPerson,
          totalSlots: isSeparated ? computedTotalSlots : Number(form.totalSlots),
          slotMode: form.slotMode,
          annualSlots: isSeparated ? Number(form.annualSlots || 0) : undefined,
          casualSlots: isSeparated ? Number(form.casualSlots || 0) : undefined,
          isOpen: form.isOpen,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "수정에 실패했습니다.");
        return;
      }
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>예약일 수정</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-label">세션 라벨</Label>
            <Input id="edit-label" value={form.label} onChange={(e) => update("label", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-startTime">시작 시간</Label>
            <Input
              id="edit-startTime"
              type="time"
              value={form.startTime}
              onChange={(e) => update("startTime", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-endTime">종료 시간</Label>
            <Input
              id="edit-endTime"
              type="time"
              value={form.endTime}
              onChange={(e) => update("endTime", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-location">장소</Label>
            <Input
              id="edit-location"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-dutyPerson">듀티 담당자</Label>
            <Input
              id="edit-dutyPerson"
              value={form.dutyPerson}
              onChange={(e) => update("dutyPerson", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-slotMode">슬롯 정책</Label>
            <Select
              id="edit-slotMode"
              value={form.slotMode}
              onChange={(e) => update("slotMode", e.target.value as SlotMode)}
            >
              <option value="COMBINED">통합 슬롯 (COMBINED)</option>
              <option value="SEPARATED">분리 슬롯 (SEPARATED)</option>
            </Select>
          </div>

          {isSeparated ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-annualSlots">연 멤버 슬롯 수</Label>
                <Input
                  id="edit-annualSlots"
                  type="number"
                  min={0}
                  value={form.annualSlots}
                  onChange={(e) => update("annualSlots", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-casualSlots">캐주얼 슬롯 수</Label>
                <Input
                  id="edit-casualSlots"
                  type="number"
                  min={0}
                  value={form.casualSlots}
                  onChange={(e) => update("casualSlots", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-totalSlots">전체 슬롯 수</Label>
                <Input id="edit-totalSlots" type="number" value={computedTotalSlots} disabled readOnly />
                <p className="text-xs text-muted-foreground">
                  연 멤버 슬롯 + 캐주얼 슬롯 합으로 자동 계산됩니다.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="edit-totalSlots">전체 슬롯 수</Label>
              <Input
                id="edit-totalSlots"
                type="number"
                min={0}
                value={form.totalSlots}
                onChange={(e) => update("totalSlots", e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              id="edit-isOpen"
              type="checkbox"
              checked={form.isOpen}
              onChange={(e) => update("isOpen", e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="edit-isOpen">공개(신청 가능)</Label>
          </div>

          {showOverbookWarning && (
            <p role="alert" aria-live="assertive" className="col-span-full text-sm font-medium text-destructive">
              현재 확정 인원({confirmedCount}명)보다 적은 슬롯 수({totalSlotsNum}명)는 저장할 수 없습니다.
            </p>
          )}

          {error && (
            <p role="alert" aria-live="assertive" className="col-span-full text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="col-span-full">
            <Button type="submit" disabled={loading}>
              {loading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
