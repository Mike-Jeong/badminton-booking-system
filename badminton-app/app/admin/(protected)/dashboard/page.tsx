import { getTodaySummary, getSummaryByDateRange } from "@/lib/services/dashboardService";
import { addDaysToDateOnly, getDayOfWeekForDateOnly, getDayOfWeekLabelKo } from "@/lib/timezone";
import { DashboardRangeFilter } from "@/components/admin/DashboardRangeFilter";
import { DashboardSummaryTable } from "@/components/admin/DashboardSummaryTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const today = await getTodaySummary();
  const from = params.from ?? today.date;
  const to = params.to ?? addDaysToDateOnly(today.date, 30);
  const range = await getSummaryByDateRange(from, to);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">관리자 대시보드</h1>
        <p className="text-sm text-muted-foreground">
          Pacific/Auckland(뉴질랜드) 기준으로 집계됩니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            오늘 ({today.date} {getDayOfWeekLabelKo(getDayOfWeekForDateOnly(today.date))})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">확정 인원</p>
              <p className="text-xl font-semibold">{today.totalConfirmed}명</p>
            </div>
            <div>
              <p className="text-muted-foreground">대기 인원</p>
              <p className="text-xl font-semibold">{today.totalWaiting}명</p>
            </div>
            <div>
              <p className="text-muted-foreground">취소 인원</p>
              <p className="text-xl font-semibold">{today.totalCancelled}명</p>
            </div>
          </div>
          <DashboardSummaryTable sessions={today.sessions} emptyMessage="오늘 등록된 예약일이 없습니다." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>날짜별 현황 ({from} ~ {to})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DashboardRangeFilter from={from} to={to} />
          <DashboardSummaryTable sessions={range} emptyMessage="해당 기간에 등록된 예약일이 없습니다." />
        </CardContent>
      </Card>
    </div>
  );
}
