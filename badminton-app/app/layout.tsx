import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "배드민턴 예약 관리 시스템",
  description: "동호회 배드민턴 예약 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
