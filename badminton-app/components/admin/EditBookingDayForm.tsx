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
  dutyPersonId: string | null;
  totalSlots: number;
  annualSlots: number;
  casualSlots: number;
  slotMode: SlotMode;
  isOpen: boolean;
}

/** 듀티 담당자 드롭다운 선택지(requirements.md 28.3번). */
export interface DutyPersonOption {
  id: string;
  name: string;
  isActive: boolean;
}

export function EditBookingDayForm({
  bookingDay,
  confirmedCount,
  dutyPersons,
}: {
  bookingDay: EditableBookingDay;
  confirmedCount: number;
  /**
   * 활성 계정 목록. 현재 값(bookingDay.dutyPersonId)이 이미 비활성화된 계정을 가리키면
   * 그 계정도 포함되어 내려온다(선택값이 사라지지 않도록, requirements.md 28.3번).
   */
  dutyPersons: DutyPersonOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    label: bookingDay.label ?? "",
    startTime: bookingDay.startTime,
    endTime: bookingDay.endTime,
    location: bookingDay.location,
    dutyPersonId: bookingDay.dutyPersonId ?? "",
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
  const selectedDutyPerson = dutyPersons.find((p) => p.id === form.dutyPersonId) ?? null;

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
          // 듀티 계정 선택 시 표시용 텍스트(dutyPerson)와 FK(dutyPersonId)를 함께 보낸다(D-36).
          dutyPerson: selectedDutyPerson?.name ?? bookingDay.dutyPerson,
          dutyPersonId: form.dutyPersonId || null,
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
            <Label htmlFor="edit-dutyPersonId">듀티 담당자</Label>
            <Select
              id="edit-dutyPersonId"
              value={form.dutyPersonId}
              onChange={(e) => update("dutyPersonId", e.target.value)}
            >
              {/* 기존 예약일은 dutyPersonId가 없고 텍스트만 있을 수 있다(소급 반영 없음, D-36).
                  그 경우 현재 텍스트 값을 "계정 미연결" 선택지로 보여준다. */}
              <option value="">
                {bookingDay.dutyPersonId
                  ? "계정 연결 해제"
                  : `계정 미연결${bookingDay.dutyPerson ? ` (현재: ${bookingDay.dutyPerson})` : ""}`}
              </option>
              {dutyPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isActive ? "" : " (비활성)"}
                </option>
              ))}
            </Select>
            {selectedDutyPerson && !selectedDutyPerson.isActive && (
              <p className="text-xs text-muted-foreground">
                현재 배정된 계정은 비활성 상태입니다. 그대로 저장할 수 있지만, 해당 담당자는 듀티
                화면에 로그인할 수 없습니다.
              </p>
            )}
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
