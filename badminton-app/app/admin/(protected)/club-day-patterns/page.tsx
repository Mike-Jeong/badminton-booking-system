import { listClubDayPatterns } from "@/lib/services/clubDayPatternService";
import { ClubDayPatternsPanel } from "@/components/admin/ClubDayPatternsPanel";

export const dynamic = "force-dynamic";

export default async function AdminClubDayPatternsPage() {
  const patterns = await listClubDayPatterns();

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
        patterns={patterns.map((p) => ({
          id: p.id,
          name: p.name,
          dayOfWeek: p.dayOfWeek,
          label: p.label,
          startTime: p.startTime,
          endTime: p.endTime,
          location: p.location,
          dutyPerson: p.dutyPerson,
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
