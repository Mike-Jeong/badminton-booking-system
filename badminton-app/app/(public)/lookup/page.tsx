import { CancelLookup } from "@/components/public/CancelLookup";

export default function LookupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">내 예약 조회/취소</h2>
        <p className="text-sm text-muted-foreground">
          전화번호를 입력하면 등록된 예약 목록을 확인하고 취소할 수 있습니다.
        </p>
      </div>
      <CancelLookup />
    </div>
  );
}
