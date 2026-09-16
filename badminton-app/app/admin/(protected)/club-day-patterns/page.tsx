import { listClubDayPatterns } from "@/lib/services/clubDayPatternService";
import { listDutyPersons } from "@/lib/services/dutyPersonService";
import { ClubDayPatternsPanel } from "@/components/admin/ClubDayPatternsPanel";

export const dynamic = "force-dynamic";

export default async function AdminClubDayPatternsPage() {
  const [patterns, allDutyPersons] = await Promise.all([
    listClubDayPatterns(),
    listDutyPersons(),
  ]);

  // 활성 계정 + (어떤 패턴이 이미 배정하고 있는) 비활성 계정만 체크박스 선택지로 내려준다
  // (수정 폼에서 현재 선택 상태가 사라지지 않도록, requirements.md 28.3번, decisions.md D-39).
  const referencedIds = new Set(
    patterns.flatMap((p) => p.dutyPersonAssignments.map((a) => a.dutyPersonId))
  );
  const dutyPersons = allDutyPersons
    .filter((p) => p.isActive || referencedIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, isActive: p.isActive }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">클럽데이 패턴 관리</h1>
        <p className="text-sm text-muted-foreground">
          요일별 반복 규칙을 등록하면, 매일 자정 근처 크론이 오늘 요일과 일치하는 활성 패턴으로
          예약일을 자동 생성하고 즉시 공개합니다.
        </p>
      </div>
      <ClubDayPatternsPanel
        dutyPersons={dutyPersons}
        patterns={patterns.map((p) => ({
          id: p.id,
          name: p.name,
          dayOfWeek: p.dayOfWeek,
          label: p.label,
          startTime: p.startTime,
          endTime: p.endTime,
          location: p.location,
          dutyPerson: p.dutyPerson,
          dutyPersonIds: p.dutyPersonAssignments.map((a) => a.dutyPersonId),
          totalSlots: p.totalSlots,
          annualSlots: p.annualSlots,
          casualSlots: p.casualSlots,
          slotMode: p.slotMode,
          autoAssignMonthlyMembers: p.autoAssignMonthlyMembers,
          isActive: p.isActive,
        }))}
      />
    </div>
  );
}
