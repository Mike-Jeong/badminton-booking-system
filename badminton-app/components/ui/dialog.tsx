"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 최소 구현 모달(Radix Dialog 등 추가 의존성 없이, 이 프로젝트의 다른 components/ui/*와
 * 동일하게 직접 작성). 포커스 트랩 등 복잡한 접근성 기능 없이, 배경 클릭/닫기 버튼으로
 * 닫히는 단순 오버레이만 필요한 곳(예: QR 코드 보기)에 사용한다.
 */
export function Dialog({
  open,
  onClose,
  title,
  closeLabel = "닫기",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={closeLabel}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
