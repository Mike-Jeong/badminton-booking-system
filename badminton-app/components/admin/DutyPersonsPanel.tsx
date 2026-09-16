"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DutyPersonRow {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * 듀티 담당자 계정 관리 패널(requirements.md 28.2번, decisions.md D-36·D-37).
 * 삭제 버튼은 의도적으로 없다 — 예약일/패턴이 이 계정을 FK로 참조하므로 비활성화(isActive)만
 * 제공한다(D-37). 비활성 계정도 목록에 배지로 계속 표시된다.
 */
export function DutyPersonsPanel({ dutyPersons }: { dutyPersons: DutyPersonRow[] }) {
  const router = useRouter();

  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});

  async function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/duty-persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, password: createPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json?.error?.message ?? "등록에 실패했습니다.");
        return;
      }
      setCreateName("");
      setCreatePassword("");
      router.refresh();
    } catch {
      setCreateError("네트워크 오류가 발생했습니다.");
    } finally {
      setCreateLoading(false);
    }
  }

  function startEdit(person: DutyPersonRow) {
    setEditingId(person.id);
    setEditName(person.name);
    setEditPassword("");
    setRowError((prev) => ({ ...prev, [person.id]: "" }));
    setRowMessage((prev) => ({ ...prev, [person.id]: "" }));
  }

  async function handleEditSave(id: string) {
    setRowLoadingId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    setRowMessage((prev) => ({ ...prev, [id]: "" }));
    try {
      const payload: { name: string; password?: string } = { name: editName };
      // 비밀번호는 입력한 경우에만 보낸다(빈 값이면 기존 비밀번호 유지).
      if (editPassword) payload.password = editPassword;

      const res = await fetch(`/api/admin/duty-persons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: json?.error?.message ?? "수정에 실패했습니다." }));
        return;
      }
      setEditingId(null);
      setRowMessage((prev) => ({
        ...prev,
        [id]: editPassword ? "저장했습니다(비밀번호 변경됨)." : "저장했습니다.",
      }));
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleToggleActive(person: DutyPersonRow) {
    if (
      person.isActive &&
      !window.confirm(
        `${person.name} 계정을 비활성화하시겠습니까?\n비활성화하면 즉시 로그인할 수 없고, 이미 로그인된 세션도 다음 요청부터 차단됩니다.\n(이미 배정된 예약일의 연결은 그대로 유지됩니다.)`
      )
    ) {
      return;
    }
    setRowLoadingId(person.id);
    setRowError((prev) => ({ ...prev, [person.id]: "" }));
    setRowMessage((prev) => ({ ...prev, [person.id]: "" }));
    try {
      const res = await fetch(`/api/admin/duty-persons/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !person.isActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({
          ...prev,
          [person.id]: json?.error?.message ?? "처리에 실패했습니다.",
        }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [person.id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>듀티 담당자 등록</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="duty-create-name">이름</Label>
              <Input
                id="duty-create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                로그인 아이디 역할을 하므로 중복될 수 없습니다.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duty-create-password">비밀번호</Label>
              <Input
                id="duty-create-password"
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">최소 4자. 해시로 저장되어 다시 볼 수 없습니다.</p>
            </div>

            {createError && (
              <p role="alert" aria-live="assertive" className="col-span-full text-sm text-destructive">
                {createError}
              </p>
            )}

            <div className="col-span-full">
              <Button type="submit" disabled={createLoading}>
                {createLoading ? "등록 중..." : "담당자 등록"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>듀티 담당자 목록 ({dutyPersons.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>상태</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dutyPersons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    등록된 듀티 담당자가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {dutyPersons.map((person) =>
                editingId === person.id ? (
                  <TableRow key={person.id}>
                    <TableCell colSpan={3}>
                      <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor={`duty-edit-name-${person.id}`}>이름</Label>
                          <Input
                            id={`duty-edit-name-${person.id}`}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`duty-edit-password-${person.id}`}>새 비밀번호 (선택)</Label>
                          <Input
                            id={`duty-edit-password-${person.id}`}
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            autoComplete="new-password"
                            placeholder="변경할 때만 입력"
                          />
                          <p className="text-xs text-muted-foreground">
                            비워두면 기존 비밀번호가 유지됩니다.
                          </p>
                        </div>
                        <div className="col-span-full flex flex-col items-start gap-2">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={rowLoadingId === person.id}
                              onClick={() => handleEditSave(person.id)}
                            >
                              저장
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                              취소
                            </Button>
                          </div>
                          {rowError[person.id] && (
                            <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                              {rowError[person.id]}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">{person.name}</TableCell>
                    <TableCell>
                      <Badge variant={person.isActive ? "default" : "secondary"}>
                        {person.isActive ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(person)}>
                            이름/비밀번호 변경
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowLoadingId === person.id}
                            onClick={() => handleToggleActive(person)}
                          >
                            {person.isActive ? "비활성화" : "활성화"}
                          </Button>
                        </div>
                        {rowMessage[person.id] && (
                          <p aria-live="polite" className="text-xs text-muted-foreground">
                            {rowMessage[person.id]}
                          </p>
                        )}
                        {rowError[person.id] && (
                          <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                            {rowError[person.id]}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
