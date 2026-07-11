"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DashboardRangeFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(`/admin/dashboard?from=${fromValue}&to=${toValue}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="range-from">시작일</Label>
        <Input id="range-from" type="date" value={fromValue} onChange={(e) => setFromValue(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="range-to">종료일</Label>
        <Input id="range-to" type="date" value={toValue} onChange={(e) => setToValue(e.target.value)} />
      </div>
      <Button type="submit" variant="outline">
        조회
      </Button>
    </form>
  );
}
