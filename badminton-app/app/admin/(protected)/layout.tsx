import Link from "next/link";
import { LogoutButton } from "@/components/admin/LogoutButton";

// 로그인 여부 검증(리다이렉트/401)은 middleware.ts가 /admin/:path*(단 /admin/login 제외)에
// 대해 이미 보장한다. 이 레이아웃은 /admin/login을 제외한 관리자 화면에만 적용된다
// (route group "(protected)"는 URL에 나타나지 않는다).
export default function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-4">
          <nav className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link href="/admin/dashboard" className="text-sm font-semibold">
              대시보드
            </Link>
            <Link href="/admin/booking-days" className="text-sm font-semibold">
              예약일 관리
            </Link>
            <Link href="/admin/annual-members" className="text-sm font-semibold">
              연 멤버 관리
            </Link>
            <Link href="/admin/monthly-members" className="text-sm font-semibold">
              월 멤버 관리
            </Link>
            <Link href="/admin/club-day-patterns" className="text-sm font-semibold">
              클럽데이 패턴 관리
            </Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
