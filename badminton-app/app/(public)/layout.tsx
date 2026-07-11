import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex items-center justify-between py-4">
          <Link href="/" className="text-lg font-semibold">
            배드민턴 예약
          </Link>
          <Link href="/lookup" className="text-sm text-muted-foreground hover:underline">
            내 예약 조회/취소
          </Link>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
