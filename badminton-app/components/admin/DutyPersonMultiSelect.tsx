"use client";

import { Label } from "@/components/ui/label";

/**
 * 예약일/클럽데이 패턴에 배정할 듀티 담당자 계정 선택지(requirements.md 28.3번).
 * 등록 폼은 활성 계정만, 수정 폼은 "활성 계정 + 현재 이미 배정된 비활성 계정"이 내려온다.
 */
export interface DutyPersonOption {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * 듀티 담당자 다중 선택(체크박스 목록, decisions.md D-39 — 예약일/패턴 하나에 여러 명 배정 가능,
 * 인원 상한 없음). 단일 드롭다운(D-36)을 대체한다.
 *
 * - 0명 선택도 허용한다(그 경우 서버는 관리자가 입력/보관 중인 dutyPerson 텍스트를 그대로 둔다).
 * - 표시용 dutyPerson 텍스트는 서버가 이름순으로 정렬해 생성하므로, 여기서 체크 순서를 기억하거나
 *   클라이언트가 텍스트를 만들어 보내지 않는다.
 */
export function DutyPersonMultiSelect({
  idPrefix,
  options,
  selectedIds,
  onChange,
  /** 계정을 하나도 선택하지 않았을 때 아래에 보여줄 안내 문구(수정 폼의 "현재 텍스트 유지" 안내 등). */
  emptySelectionHint,
}: {
  idPrefix: string;
  options: DutyPersonOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  emptySelectionHint?: string;
}) {
  function toggle(id: string, checked: boolean) {
    if (checked) {
      if (selectedIds.includes(id)) return;
      onChange([...selectedIds, id]);
    } else {
      onChange(selectedIds.filter((v) => v !== id));
    }
  }

  const selectedInactive = options.filter((p) => !p.isActive && selectedIds.includes(p.id));

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-dutyPersons`}>듀티 담당자 (여러 명 선택 가능)</Label>
      <div
        id={`${idPrefix}-dutyPersons`}
        role="group"
        aria-label="듀티 담당자 선택"
        className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-input p-2"
      >
        {options.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            등록된 듀티 담당자가 없습니다. &quot;듀티 담당자 관리&quot;에서 먼저 계정을 등록해주세요.
          </p>
        )}
        {options.map((p) => (
          <label
            key={p.id}
            htmlFor={`${idPrefix}-duty-${p.id}`}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent"
          >
            <input
              id={`${idPrefix}-duty-${p.id}`}
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={selectedIds.includes(p.id)}
              onChange={(e) => toggle(p.id, e.target.checked)}
            />
            <span>{p.name}</span>
            {!p.isActive && <span className="text-xs text-muted-foreground">(비활성)</span>}
          </label>
        ))}
      </div>
      {selectedIds.length === 0 && emptySelectionHint && (
        <p className="text-xs text-muted-foreground">{emptySelectionHint}</p>
      )}
      {selectedInactive.length > 0 && (
        <p className="text-xs text-muted-foreground">
          배정된 계정 중 비활성 상태가 있습니다({selectedInactive.map((p) => p.name).join(", ")}).
          그대로 저장할 수 있지만, 해당 담당자는 듀티 화면에 로그인할 수 없습니다.
        </p>
      )}
    </div>
  );
}
