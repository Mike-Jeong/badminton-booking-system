/**
 * ParticipantCodeService (architecture.md 2장, requirements.md 27번, decisions.md D-33·D-34)
 * - ensureParticipantCode / ensureParticipantCodesBatch: 예약 생성 경로에서 코드 발급 또는 재사용
 * - listParticipantCodesForExport: CSV 내보내기 전용(excludedFromExport=false만)
 * - listParticipantCodesForAdmin / countParticipantCodes: 관리자 화면 목록 전용(제외 필터 없음)
 * - setParticipantCodeExclusion: 내보내기 제외 토글(opt-out, D-34 개정 1)
 * - recordParticipantCodeExport / listParticipantCodeExportLogs: 내보내기 이력(D-34 개정 2)
 *
 * 신원 키는 이 시스템이 이미 예약 중복 판정(requirements.md 18번)·연 멤버 판정(4번)에 쓰는 것과
 * 동일한 `normalizedName + phoneHash` 조합이다(새 개념을 도입하지 않는다, D-33).
 * AnnualMember/Booking 어느 쪽에도 종속되지 않으며, memberType/source와 무관하게 예약을 신청한
 * 모든 사람이 대상이다.
 */

import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { normalizeName, normalizePhone } from "@/lib/normalize";
import { hashPhone, encryptPhone, decryptPhone } from "@/lib/security/phoneCrypto";
import type { PrismaClientOrTx } from "@/lib/services/annualMemberService";

/**
 * QR에 담기는 순수 랜덤 코드(12자). 이름/전화번호 등 어떤 정보도 인코딩하지 않는다
 * (requirements.md 27.3번). 새 npm 의존성 없이 Node 내장 crypto만 사용한다
 * (lib/security/phoneCrypto.ts와 동일한 방식). 9바이트 → base64url 12자.
 */
function generateParticipantCode(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/** Prisma 유니크 제약 위반(P2002) 여부. 동시 요청 레이스 처리용. */
function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}

export interface EnsureParticipantCodeResult {
  id: string;
  code: string;
}

/**
 * 이 신원(normalizedName + phoneHash)의 참여자 코드를 발급하거나 이미 있으면 재사용한다
 * (requirements.md 27.3번). createBooking/adminCreateBooking이 예약 생성과 같은 트랜잭션 안에서
 * 호출하며, 반환된 code를 예약 응답 DTO에 participantCode로 병합한다.
 *
 * 이미 있는 경우 기존 행을 그대로 재사용하며 어떤 필드도 갱신하지 않는다 — name은 신원 키인
 * normalizedName과 항상 같은 값으로만 생성되므로, 조회에 쓴 normalizedName과 달라지는 경우 자체가
 * 없다(이름이 바뀌면 신원 키가 달라져 다른 행으로 취급된다). phoneEncrypted도 재암호화하지
 * 않는다 — phoneHash가 일치한 시점에 평문 값이 이미 동일함이 보장되고, AES-GCM은 매번 다른 IV로
 * 암호문이 달라져 재암호화 여부를 암호문 비교로 판단할 수도 없다(decisions.md D-33).
 * excludedFromExport 등 관리자가 설정한 값은 절대 건드리지 않는다(D-34 개정 1).
 */
export async function ensureParticipantCode(
  name: string,
  phone: string,
  client: PrismaClientOrTx = prisma
): Promise<EnsureParticipantCodeResult> {
  const normalizedName = normalizeName(name);
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedName) {
    throw new ValidationError("이름을 입력해주세요.");
  }
  if (!normalizedPhone) {
    throw new ValidationError("전화번호를 입력해주세요.");
  }
  const phoneHash = hashPhone(normalizedPhone);

  const existing = await client.participantCode.findUnique({
    where: { normalizedName_phoneHash: { normalizedName, phoneHash } },
  });
  if (existing) {
    return { id: existing.id, code: existing.code };
  }

  try {
    const created = await client.participantCode.create({
      data: {
        name: normalizedName,
        normalizedName,
        phoneHash,
        phoneEncrypted: encryptPhone(normalizedPhone),
        code: generateParticipantCode(),
      },
    });
    return { id: created.id, code: created.code };
  } catch (err) {
    if (!isUniqueConstraintError(err)) {
      throw err;
    }
    // 동시 요청 레이스: 다른 요청이 먼저 만든 레코드를 그대로 재사용한다(재발급 아님).
    const raced = await client.participantCode.findUnique({
      where: { normalizedName_phoneHash: { normalizedName, phoneHash } },
    });
    if (!raced) {
      throw err;
    }
    return { id: raced.id, code: raced.code };
  }
}

export interface ParticipantForCode {
  name: string;
  phone: string;
}

/**
 * 월 멤버 자동 배정(applyMonthlyMembersToBookingDay) 전용 배치 버전. 대상 인원 수와 무관하게
 * 쿼리 수를 O(1)로 유지한다(멤버마다 순차 조회/생성하면 원격 DB 왕복이 누적돼 트랜잭션
 * 타임아웃에 걸렸던 전례가 있다 — monthlyMemberService.ts 주석 참고).
 *
 * 기존 행은 갱신 없이 그대로 둔다(ensureParticipantCode와 동일 — name은 신원 키의 일부라
 * 애초에 달라질 수 없다).
 *
 * 기존 등록 여부 확인은 `participants` 개수만큼 OR 조건을 쌓는 대신 `ParticipantCode` 전체의
 * 신원 키만 한 번에 조회해 메모리에서 대조한다. 신원 개수만큼 OR 절을 쌓으면 SQLite/libSQL의
 * 표현식 트리 깊이 제한(약 100)에 걸려 대량 배치(예: 프로덕션 백필, 전체 예약 828건에서 나온
 * 고유 신원)에서 `SQLITE_UNKNOWN: Expression tree is too large` 에러로 실패한 전례가 있다.
 * `ParticipantCode`는 실제 참여 인원 수에 비례해 천천히 느는 작은 테이블이라(예약 건수가 아니라
 * 사람 수만큼만 존재) 전체 조회 비용이 문제되지 않는다.
 */
export async function ensureParticipantCodesBatch(
  participants: ParticipantForCode[],
  client: PrismaClientOrTx = prisma
): Promise<void> {
  const byKey = new Map<string, { normalizedName: string; phoneHash: string; normalizedPhone: string }>();
  for (const participant of participants) {
    const normalizedName = normalizeName(participant.name);
    const normalizedPhone = normalizePhone(participant.phone);
    if (!normalizedName || !normalizedPhone) continue;
    const phoneHash = hashPhone(normalizedPhone);
    byKey.set(`${normalizedName} ${phoneHash}`, { normalizedName, phoneHash, normalizedPhone });
  }
  const pairs = Array.from(byKey.values());
  if (pairs.length === 0) return;

  const existing = await client.participantCode.findMany({
    select: { normalizedName: true, phoneHash: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.normalizedName} ${e.phoneHash}`));

  const toCreate: Prisma.ParticipantCodeCreateManyInput[] = pairs
    .filter((p) => !existingKeys.has(`${p.normalizedName} ${p.phoneHash}`))
    .map((p) => ({
      name: p.normalizedName,
      normalizedName: p.normalizedName,
      phoneHash: p.phoneHash,
      phoneEncrypted: encryptPhone(p.normalizedPhone),
      code: generateParticipantCode(),
    }));

  if (toCreate.length > 0) {
    await client.participantCode.createMany({ data: toCreate });
  }
}

export interface ParticipantCodeExportRow {
  code: string;
  name: string;
  phone: string;
}

/**
 * CSV 내보내기 전용 조회(requirements.md 27.5.1번). excludedFromExport=false인 행만 대상이며,
 * 그 외 어떤 필터(활성/비활성, ANNUAL/CASUAL 등)도 적용하지 않는다(decisions.md D-34).
 * 전화번호는 관리자 열람 목적으로 이 함수 안에서만 복호화한다.
 */
export async function listParticipantCodesForExport(): Promise<ParticipantCodeExportRow[]> {
  const rows = await prisma.participantCode.findMany({
    where: { excludedFromExport: false },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    phone: decryptPhone(row.phoneEncrypted),
  }));
}

export interface ParticipantCodeAdminRow {
  id: string;
  code: string;
  name: string;
  phone: string;
  excludedFromExport: boolean;
}

/**
 * 관리자 화면(/admin/participant-codes) 목록 전용 조회. 제외 설정된 행도 계속 표시해야 하므로
 * (관리자가 다시 포함시킬 수 있어야 함, requirements.md 27.5.2번) 필터 없이 전체를 반환하고,
 * 토글 UI가 대상을 특정하고 상태를 표시할 수 있도록 id/excludedFromExport를 함께 내려준다.
 */
export async function listParticipantCodesForAdmin(): Promise<ParticipantCodeAdminRow[]> {
  const rows = await prisma.participantCode.findMany({ orderBy: { name: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    phone: decryptPhone(row.phoneEncrypted),
    excludedFromExport: row.excludedFromExport,
  }));
}

/** 참여자 코드 총 발급 건수(제외 설정과 무관한 전체 수). */
export async function countParticipantCodes(): Promise<number> {
  return prisma.participantCode.count();
}

/**
 * 내보내기 제외 토글(관리자 전용, requirements.md 27.5.2번). 이 라우트로 바꿀 수 있는 값은
 * excludedFromExport 하나뿐이다 — ParticipantCode는 예약 생성 시 시스템이 자동으로만 채우는
 * 파생 데이터이므로 code/name 등을 관리자가 임의로 수정하는 API는 두지 않는다(D-34).
 */
export async function setParticipantCodeExclusion(id: string, excludedFromExport: boolean) {
  const existing = await prisma.participantCode.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("참여자 코드를 찾을 수 없습니다.");
  }
  const updated = await prisma.participantCode.update({
    where: { id },
    data: { excludedFromExport },
  });
  return {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    excludedFromExport: updated.excludedFromExport,
  };
}

/**
 * 참여자 코드 삭제(관리자 전용, requirements.md 27.5.4번). 제외 토글과 달리 행 자체를 완전히
 * 없앤다 — 잘못 등록되어 다시 쓰일 일이 없는 신원을 정리하는 용도다. 삭제 후 같은
 * normalizedName+phoneHash 조합으로 다시 예약이 들어오면 새 코드가 자동 발급된다(D-33의 발급
 * 규칙이 그대로 적용되며, 이 삭제 자체는 별도 처리를 요구하지 않는다).
 */
export async function deleteParticipantCode(id: string): Promise<void> {
  const existing = await prisma.participantCode.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("참여자 코드를 찾을 수 없습니다.");
  }
  await prisma.participantCode.delete({ where: { id } });
}

/**
 * CSV 내보내기 이력 기록(requirements.md 27.5.3번). GET /api/admin/participant-codes/export가
 * 실제로 CSV를 생성해 응답하는 시점에만 호출한다 — 화면 조회에서는 호출하지 않는다.
 * "누가" 받았는지는 기록하지 않는다(관리자 단일 계정 체제, decisions.md D-34 개정 2).
 */
export async function recordParticipantCodeExport(exportedCount: number) {
  return prisma.participantCodeExportLog.create({ data: { exportedCount } });
}

export interface ParticipantCodeExportLogRow {
  id: string;
  exportedAt: Date;
  exportedCount: number;
}

/** 최근 내보내기 이력(기본 5건). 관리자 화면 상단 표시용. */
export async function listParticipantCodeExportLogs(limit = 5): Promise<ParticipantCodeExportLogRow[]> {
  return prisma.participantCodeExportLog.findMany({
    orderBy: { exportedAt: "desc" },
    take: limit,
  });
}
