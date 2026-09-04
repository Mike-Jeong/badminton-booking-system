import {
  listParticipantCodesForAdmin,
  countParticipantCodes,
  listParticipantCodeExportLogs,
} from "@/lib/services/participantCodeService";
import { ParticipantCodesPanel } from "@/components/admin/ParticipantCodesPanel";

export const dynamic = "force-dynamic";

/**
 * 참여자 코드 관리 화면(requirements.md 27.5번). 다른 관리자 페이지와 동일하게 Server Component가
 * 서비스 함수를 직접 호출한다. 화면 조회만으로는 내보내기 이력을 기록하지 않는다(D-34 개정 2 —
 * 이력은 CSV 다운로드 라우트에서만 기록).
 */
export default async function AdminParticipantCodesPage() {
  const [codes, totalCount, exportLogs] = await Promise.all([
    listParticipantCodesForAdmin(),
    countParticipantCodes(),
    listParticipantCodeExportLogs(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">참여자 코드 관리</h1>
        <p className="text-sm text-muted-foreground">
          예약을 신청한 모든 참여자에게 자동으로 발급되는 영구 식별 코드입니다. 오프라인 게임 로테이션
          프로그램에 전달할 &quot;코드-이름-전화번호&quot; 매핑표를 CSV로 내려받을 수 있습니다.
          제외 설정한 인원은 이후 모든 CSV 내보내기에서 계속 빠집니다.
        </p>
      </div>
      <ParticipantCodesPanel codes={codes} totalCount={totalCount} exportLogs={exportLogs} />
    </div>
  );
}
