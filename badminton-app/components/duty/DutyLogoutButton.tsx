"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** 듀티 세션 쿠키(duty_session)만 무효화한다 — 관리자 세션에는 영향을 주지 않는다(28.4번). */
export function DutyLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/duty/logout", { method: "POST" });
    } finally {
      setLoading(false);
      router.push("/duty/login");
      router.refresh();
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout} disabled={loading}>
      {loading ? "로그아웃 중..." : "로그아웃"}
    </Button>
  );
}
