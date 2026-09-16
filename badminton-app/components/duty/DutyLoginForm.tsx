"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 듀티 담당자 로그인 폼(requirements.md 28.4번). 관리자 로그인(LoginForm)과 동일한 패턴이지만,
 * 앱 전체 공유 비밀번호가 아니라 계정별 이름+비밀번호 조합으로 로그인한다.
 * 듀티 화면은 관리자 화면과 마찬가지로 한국어만 사용한다(i18n 사전 사용 안 함, decisions.md D-18).
 */
export function DutyLoginForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/duty/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "로그인에 실패했습니다.");
        return;
      }
      router.push("/duty/booking-days");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>듀티 담당자 로그인</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="duty-login-name">이름</Label>
            <Input
              id="duty-login-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duty-login-password">비밀번호</Label>
            <Input
              id="duty-login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p role="alert" aria-live="assertive" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
