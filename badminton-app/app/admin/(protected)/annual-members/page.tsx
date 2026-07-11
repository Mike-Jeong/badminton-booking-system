import { listAnnualMembers } from "@/lib/services/annualMemberService";
import { AnnualMembersPanel } from "@/components/admin/AnnualMembersPanel";

export const dynamic = "force-dynamic";

export default async function AdminAnnualMembersPage() {
  const members = await listAnnualMembers();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">연 멤버 관리</h1>
        <p className="text-sm text-muted-foreground">
          이름+전화번호가 모두 일치하면 예약 시 연 멤버(ANNUAL)로 자동 판별됩니다.
        </p>
      </div>
      <AnnualMembersPanel members={members} />
    </div>
  );
}
