import { listDutyPersons } from "@/lib/services/dutyPersonService";
import { DutyPersonsPanel } from "@/components/admin/DutyPersonsPanel";

export const dynamic = "force-dynamic";

/**
 * 듀티 담당자 계정 관리 화면(requirements.md 28.2번, decisions.md D-36·D-37).
 * 다른 관리자 페이지와 동일하게 Server Component가 서비스 함수를 직접 호출한다.
 * 하드 삭제 UI는 두지 않는다(D-37) — 비활성화(isActive 토글)만 제공한다.
 */
export default async function AdminDutyPersonsPage() {
  const dutyPersons = await listDutyPersons();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">듀티 담당자 관리</h1>
        <p className="text-sm text-muted-foreground">
          게임 듀티 담당자의 로그인 계정을 등록/관리합니다. 등록된 담당자는 <code>/duty/login</code>에서
          자신의 이름과 비밀번호로 로그인해, 자신에게 배정된 예약일과 참여자 명단(이름/상태)만 조회할 수
          있습니다. 계정 삭제는 지원하지 않으며(이미 배정된 예약일과의 연결이 끊어지기 때문),
          비활성화하면 즉시 로그인과 조회가 모두 차단됩니다.
        </p>
      </div>
      <DutyPersonsPanel
        dutyPersons={dutyPersons.map((p) => ({
          id: p.id,
          name: p.name,
          isActive: p.isActive,
        }))}
      />
    </div>
  );
}
