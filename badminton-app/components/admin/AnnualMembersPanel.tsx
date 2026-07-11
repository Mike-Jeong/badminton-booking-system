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

export interface AnnualMemberRow {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  memo: string | null;
}

/**
 * 연 멤버 관리 화면(requirements.md 4번, roadmap.md Phase 4).
 * 하드 삭제는 지원하지 않는다(decisions.md D-07) — "비활성화" 버튼이 isActive=false를 호출한다.
 */
export function AnnualMembersPanel({ members }: { members: AnnualMemberRow[] }) {
  const router = useRouter();

  const [createForm, setCreateForm] = useState({ name: "", phone: "", memo: "" });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", memo: "" });
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);

  async function handleCreateSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/annual-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          phone: createForm.phone,
          memo: createForm.memo || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json?.error?.message ?? "등록에 실패했습니다.");
        return;
      }
      setCreateForm({ name: "", phone: "", memo: "" });
      router.refresh();
    } catch {
      setCreateError("네트워크 오류가 발생했습니다.");
    } finally {
      setCreateLoading(false);
    }
  }

  function startEdit(member: AnnualMemberRow) {
    setEditingId(member.id);
    setEditForm({ name: member.name, phone: member.phone, memo: member.memo ?? "" });
    setRowError((prev) => ({ ...prev, [member.id]: "" }));
  }

  async function handleEditSave(id: string) {
    setRowLoadingId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/admin/annual-members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          memo: editForm.memo || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [id]: json?.error?.message ?? "수정에 실패했습니다." }));
        return;
      }
      setEditingId(null);
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  async function handleToggleActive(member: AnnualMemberRow) {
    setRowLoadingId(member.id);
    setRowError((prev) => ({ ...prev, [member.id]: "" }));
    try {
      const res = member.isActive
        ? await fetch(`/api/admin/annual-members/${member.id}`, { method: "DELETE" })
        : await fetch(`/api/admin/annual-members/${member.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: true }),
          });
      const json = await res.json();
      if (!res.ok) {
        setRowError((prev) => ({ ...prev, [member.id]: json?.error?.message ?? "처리에 실패했습니다." }));
        return;
      }
      router.refresh();
    } catch {
      setRowError((prev) => ({ ...prev, [member.id]: "네트워크 오류가 발생했습니다." }));
    } finally {
      setRowLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>연 멤버 등록</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="annual-name">이름</Label>
              <Input
                id="annual-name"
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual-phone">전화번호</Label>
              <Input
                id="annual-phone"
                value={createForm.phone}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annual-memo">메모 (선택)</Label>
              <Input
                id="annual-memo"
                value={createForm.memo}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, memo: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={createLoading}>
              {createLoading ? "등록 중..." : "등록"}
            </Button>
          </form>
          {createError && (
            <p role="alert" aria-live="assertive" className="mt-2 text-sm text-destructive">
              {createError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>연 멤버 목록 ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>전화번호</TableHead>
                <TableHead>메모</TableHead>
                <TableHead>상태</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    등록된 연 멤버가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {members.map((member) =>
                editingId === member.id ? (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editForm.memo}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, memo: e.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={rowLoadingId === member.id}
                            onClick={() => handleEditSave(member.id)}
                          >
                            저장
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            취소
                          </Button>
                        </div>
                        {rowError[member.id] && (
                          <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                            {rowError[member.id]}
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={member.id}>
                    <TableCell>{member.name}</TableCell>
                    <TableCell>{member.phone}</TableCell>
                    <TableCell>{member.memo ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(member)}>
                            수정
                          </Button>
                          <Button
                            size="sm"
                            variant={member.isActive ? "destructive" : "secondary"}
                            disabled={rowLoadingId === member.id}
                            onClick={() => handleToggleActive(member)}
                          >
                            {member.isActive ? "비활성화" : "활성화"}
                          </Button>
                        </div>
                        {rowError[member.id] && (
                          <p role="alert" aria-live="assertive" className="text-xs text-destructive">
                            {rowError[member.id]}
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
