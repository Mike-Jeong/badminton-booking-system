"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SlotMode = "SEPARATED" | "COMBINED";

const initialState = {
  date: "",
  label: "",
  startTime: "",
  endTime: "",
  location: "",
  dutyPerson: "",
  totalSlots: "",
  annualSlots: "",
  casualSlots: "",
  slotMode: "COMBINED" as SlotMode,
  isOpen: true,
};

export function CreateBookingDayForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState<{
    createdCount: number;
    skippedCount: number;
  } | null>(null);
  const [assignmentSkipped, setAssignmentSkipped] = useState(false);

  function update<K extends keyof typeof initialState>(key: K, value: (typeof initialState)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isSeparated = form.slotMode === "SEPARATED";
  const computedTotalSlots = Number(form.annualSlots || 0) + Number(form.casualSlots || 0);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setAssignmentResult(null);
    setAssignmentSkipped(false);

    // 같은 요일에 세션이 여러 개 열리는 경우 월 멤버가 모든 세션에 중복 배정되는 것을
    // 막기 위해, 생성 시점에 자동 배정 여부를 관리자에게 직접 확인한다(decisions.md D-19).
    const autoAssignMonthlyMembers = window.confirm(
      "이 요일과 일치하는 월 멤버를 이 예약일에 자동으로 추가하시겠습니까?\n(같은 요일에 다른 세션이 이미 있다면 '취소'를 눌러 건너뛸 수 있습니다.)"
    );

    setLoading(true);
    try {
      const res = await fetch("/api/admin/booking-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
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
          autoAssignMonthlyMembers,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "예약일 생성에 실패했습니다.");
        return;
      }
      setForm(initialState);
      if (json.data?.monthlyMemberAssignment) {
        setAssignmentResult(json.data.monthlyMemberAssignment);
      } else if (!autoAssignMonthlyMembers) {
        setAssignmentSkipped(true);
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
        <CardTitle>예약일 생성</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="date">날짜</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              요일은 저장 후 서버가 자동으로 계산합니다(직접 입력 불가).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">세션 라벨 (선택)</Label>
            <Input
              id="label"
              placeholder="예: 오전, 오후, 1부"
              value={form.label}
              onChange={(e) => update("label", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startTime">시작 시간</Label>
            <Input
              id="startTime"
              type="time"
              value={form.startTime}
              onChange={(e) => update("startTime", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endTime">종료 시간</Label>
            <Input
              id="endTime"
              type="time"
              value={form.endTime}
              onChange={(e) => update("endTime", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">장소</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dutyPerson">듀티 담당자</Label>
            <Input
              id="dutyPerson"
              value={form.dutyPerson}
              onChange={(e) => update("dutyPerson", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slotMode">슬롯 정책</Label>
            <Select
              id="slotMode"
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
                <Label htmlFor="annualSlots">연 멤버 슬롯 수</Label>
                <Input
                  id="annualSlots"
                  type="number"
                  min={0}
                  value={form.annualSlots}
                  onChange={(e) => update("annualSlots", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="casualSlots">캐주얼 슬롯 수</Label>
                <Input
                  id="casualSlots"
                  type="number"
                  min={0}
                  value={form.casualSlots}
                  onChange={(e) => update("casualSlots", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalSlots">전체 슬롯 수</Label>
                <Input id="totalSlots" type="number" value={computedTotalSlots} disabled readOnly />
                <p className="text-xs text-muted-foreground">
                  연 멤버 슬롯 + 캐주얼 슬롯 합으로 자동 계산됩니다.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="totalSlots">전체 슬롯 수</Label>
              <Input
                id="totalSlots"
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
              id="isOpen"
              type="checkbox"
              checked={form.isOpen}
              onChange={(e) => update("isOpen", e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="isOpen">공개(신청 가능)</Label>
          </div>

          {assignmentResult && (
            <p aria-live="polite" className="col-span-full text-sm text-muted-foreground">
              월 멤버 자동 배정: 생성 {assignmentResult.createdCount}건 · 스킵{" "}
              {assignmentResult.skippedCount}건
            </p>
          )}
          {assignmentSkipped && (
            <p aria-live="polite" className="col-span-full text-sm text-muted-foreground">
              월 멤버 자동 배정을 건너뛰었습니다. 필요하면 예약일 상세 화면에서 수동으로 실행할 수 있습니다.
            </p>
          )}

          {error && (
            <p role="alert" aria-live="assertive" className="col-span-full text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="col-span-full">
            <Button type="submit" disabled={loading}>
              {loading ? "생성 중..." : "예약일 생성"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
