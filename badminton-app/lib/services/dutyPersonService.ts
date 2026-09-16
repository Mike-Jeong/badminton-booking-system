/**
 * DutyPersonService (architecture.md 2장, requirements.md 28.2번, decisions.md D-36·D-37)
 * - createDutyPerson / updateDutyPerson / listDutyPersons
 * - 관리자 전용 CRUD. **하드 삭제 함수가 없다**(decisions.md D-37) — BookingDayDutyPerson /
 *   ClubDayPatternDutyPerson 조인 테이블(D-39)이 이 계정을 참조하므로, 비활성화는 isActive
 *   토글(updateDutyPerson)로만 한다. prisma.dutyPerson.delete(...)는 어떤 경우에도 호출하지 않는다.
 * - 비밀번호는 평문 저장 금지. lib/security/dutyPasswordCrypto.ts의 scrypt 해시로만 저장한다(D-38).
 */

import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import { hashDutyPassword } from "@/lib/security/dutyPasswordCrypto";
import type { PrismaClientOrTx } from "@/lib/services/annualMemberService";

export interface DutyPersonInput {
  name: string;
  password: string;
}

export interface DutyPersonUpdateInput {
  name?: string;
  password?: string;
  isActive?: boolean;
}

export interface ListDutyPersonsFilter {
  /** true면 활성 계정만 반환한다(예약일/패턴 폼의 다중 선택 목록용). 기본값 false(전체). */
  activeOnly?: boolean;
}

const MIN_PASSWORD_LENGTH = 4;

function assertValidName(name: unknown): asserts name is string {
  if (typeof name !== "string" || !name.trim()) {
    throw new ValidationError("이름(name)은 필수입니다.");
  }
}

function assertValidPassword(password: unknown): asserts password is string {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
}

/**
 * 듀티 담당자 계정 등록(requirements.md 28.2번). 이름은 유니크해야 한다(로그인이 name+password
 * 조합으로 계정을 특정하므로, D-36). 이미 존재하는 이름이면 활성/비활성 여부와 무관하게 ConflictError.
 */
export async function createDutyPerson(input: DutyPersonInput) {
  assertValidName(input.name);
  assertValidPassword(input.password);

  const name = input.name.trim();
  const existing = await prisma.dutyPerson.findUnique({ where: { name } });
  if (existing) {
    throw new ConflictError(`이미 등록된 이름입니다: ${name}`);
  }

  return prisma.dutyPerson.create({
    data: {
      name,
      passwordHash: hashDutyPassword(input.password),
    },
  });
}

/**
 * 듀티 담당자 계정 수정(부분 업데이트, updateClubDayPattern/updateMonthlyMember와 동일 패턴).
 * - password가 전달된 경우에만 다시 해시해 passwordHash를 교체한다(전달되지 않으면 기존 해시 유지).
 *   이때 sessionVersion을 함께 1 증가시켜 그 계정으로 이미 발급된 세션을 모두 무효화한다
 *   (decisions.md D-38 개정 2026-09-10 — requireActiveDutyPerson이 payload의 값과 대조한다).
 * - isActive 토글도 이 함수 하나로 처리한다(별도 activate/deactivate 함수 없음).
 */
export async function updateDutyPerson(id: string, input: DutyPersonUpdateInput) {
  const existing = await prisma.dutyPerson.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("듀티 담당자를 찾을 수 없습니다.");
  }

  let name: string | undefined;
  if (input.name !== undefined) {
    assertValidName(input.name);
    name = input.name.trim();
    if (name !== existing.name) {
      const duplicated = await prisma.dutyPerson.findUnique({ where: { name } });
      if (duplicated) {
        throw new ConflictError(`이미 등록된 이름입니다: ${name}`);
      }
    }
  }

  let passwordHash: string | undefined;
  if (input.password !== undefined) {
    assertValidPassword(input.password);
    passwordHash = hashDutyPassword(input.password);
  }

  return prisma.dutyPerson.update({
    where: { id },
    data: {
      name,
      passwordHash,
      isActive: input.isActive,
      // 비밀번호가 바뀐 경우에만 세션 버전을 올린다(이름/활성 상태 변경은 세션을 끊지 않는다).
      sessionVersion: passwordHash !== undefined ? { increment: 1 } : undefined,
    },
  });
}

export interface AssignableDutyPerson {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * 예약일/클럽데이 패턴에 배정할 듀티 계정들을 한 번에 조회한다(requirements.md 28.3번,
 * decisions.md D-39 — 기존 단건 getAssignableDutyPerson을 다건으로 확장).
 *
 * - ids는 중복 제거 후 한 번의 findMany로 조회한다.
 * - 하나라도 존재하지 않으면 ValidationError로 **요청 전체를 거부**한다(부분 성공 없음, D-39).
 *   FK 위반(P2003)으로 500이 나가지 않도록 서비스에서 먼저 차단하는 역할도 겸한다.
 * - 반환값은 name 기준 오름차순으로 정렬한다 — 클라이언트가 보낸 선택 순서(체크박스를 클릭한
 *   순서)를 그대로 쓰면 dutyPerson 텍스트의 표시 순서가 매번 달라지므로, 항상 서버가 정렬한다
 *   (decisions.md D-39, 사용자 확인 2026-09-15).
 * - 비활성 계정도 조회 가능하다 — 수정 폼에서 이미 배정된 비활성 계정을 그대로 다시 저장할 수
 *   있어야 하기 때문이다(decisions.md D-36, 28.3번).
 *
 * 열린 트랜잭션 안에서 호출할 때는 반드시 그 트랜잭션 클라이언트(tx)를 client로 넘겨야 한다.
 * 모듈 전역 prisma를 쓰면 트랜잭션과 별개 커넥션이 되어 잠금 경합 → 트랜잭션 타임아웃(P2028)이
 * 발생한다(updateBookingDay 사례). assertSlotsNotBelowConfirmed와 같은 패턴.
 */
export async function getAssignableDutyPersons(
  ids: string[],
  client: PrismaClientOrTx = prisma
): Promise<AssignableDutyPerson[]> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id)));
  if (uniqueIds.length === 0) {
    return [];
  }

  const records = await client.dutyPerson.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, isActive: true },
  });

  if (records.length !== uniqueIds.length) {
    const found = new Set(records.map((r) => r.id));
    const missing = uniqueIds.filter((id) => !found.has(id));
    throw new ValidationError(
      `선택한 듀티 담당자 계정을 찾을 수 없습니다: ${missing.join(", ")}`
    );
  }

  // 항상 이름순으로 정렬해 돌려준다(클라이언트가 보낸 순서를 신뢰하지 않는다, D-39).
  return records.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/**
 * 듀티 담당자 목록. 관리자 화면(/admin/duty-persons)은 필터 없이 전체(활성+비활성)를 받아
 * 배지로 구분 표시하고, 예약일/패턴 폼의 다중 선택 목록은 activeOnly: true로 호출한다.
 * (수정 폼에서 현재 배정된 계정이 비활성인 경우 그 계정을 목록에 합치는 처리는 호출부 책임 —
 *  architecture.md 2장 DutyPersonService 참고)
 */
export async function listDutyPersons(filter: ListDutyPersonsFilter = {}) {
  return prisma.dutyPerson.findMany({
    where: filter.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}
