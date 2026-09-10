import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireActiveDutyPerson } from "@/lib/services/dutyAuthService";
import { DutyAuthError } from "@/lib/errors";
import { DutyLogoutButton } from "@/components/duty/DutyLogoutButton";

export const dynamic = "force-dynamic";

/**
 * 듀티 전용 화면 공통 레이아웃(requirements.md 28번, decisions.md D-38).
 * middleware.ts는 듀티 세션 쿠키의 서명/만료만 검증하는 1차 방어선이므로, 여기서
 * requireActiveDutyPerson으로 매 요청 DutyPerson.isActive를 DB에서 재조회한다
 * (2차·최종 방어선 — 관리자가 방금 비활성화한 계정은 이미 유효한 세션이 있어도 즉시 차단된다).
 * 이 레이아웃은 /duty/login에는 적용되지 않는다(route group "(protected)"는 URL에 나타나지 않는다).
 */
export default async function DutyProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();

  let dutyPerson;
  try {
    dutyPerson = await requireActiveDutyPerson({ cookies: cookieStore });
  } catch (err) {
    if (err instanceof DutyAuthError) {
      redirect("/duty/login");
    }
    throw err;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
          <nav className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link href="/duty/booking-days" className="text-sm font-semibold">
              내 듀티 예약일
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{dutyPerson.name} 님</span>
            <DutyLogoutButton />
          </div>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
