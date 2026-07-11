import { listMonthlyMembers } from "@/lib/services/monthlyMemberService";
import { listAnnualMembers } from "@/lib/services/annualMemberService";
import { MonthlyMembersPanel } from "@/components/admin/MonthlyMembersPanel";
import { getTodayInTimeZone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function AdminMonthlyMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const today = getTodayInTimeZone();
  const year = params.year ? Number(params.year) : today.year;
  const month = params.month ? Number(params.month) : today.month;

  const [monthlyMembers, annualMembers] = await Promise.all([
    listMonthlyMembers({ year, month }),
    listAnnualMembers({ isActive: true }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">월 멤버 관리</h1>
        <p className="text-sm text-muted-foreground">
          특정 연도/월/요일에 우선 자동 배정되는 멤버를 관리합니다.
        </p>
      </div>
      <MonthlyMembersPanel
        year={year}
        month={month}
        monthlyMembers={monthlyMembers.map((m) => ({
          id: m.id,
          annualMemberId: m.annualMemberId,
          annualMemberName: m.annualMember.name,
          annualMemberPhone: m.annualMember.phone,
          annualMemberActive: m.annualMember.isActive,
          year: m.year,
          month: m.month,
          dayOfWeek: m.dayOfWeek,
          isActive: m.isActive,
          memo: m.memo,
        }))}
        annualMembers={annualMembers.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
