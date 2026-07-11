/**
 * AnnualMemberService (architecture.md 2장, requirements.md 4·19번)
 * - determineMemberType: createBooking/applyMonthlyMembersToBookingDay에서 재사용
 * - createAnnualMember / updateAnnualMember / deactivateAnnualMember / listAnnualMembers
 * - 하드 삭제 없음(decisions.md D-07). "삭제" 액션은 deactivateAnnualMember(isActive=false)로 처리.
 */

import type { AnnualMember, MemberType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import { normalizeName, normalizePhone } from "@/lib/normalize";
import { hashPhone, encryptPhone, decryptPhone } from "@/lib/security/phoneCrypto";

export type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export interface MemberTypeResult {
  memberType: MemberType;
  matchedAnnualMemberId: string | null;
}

export interface AnnualMemberInput {
  name: string;
  phone: string;
  memo?: string | null;
}

export interface AnnualMemberUpdateInput {
  name?: string;
  phone?: string;
  memo?: string | null;
  isActive?: boolean;
}

export interface ListAnnualMembersFilter {
  isActive?: boolean;
}

/**
 * 이름 + 전화번호가 모두 일치하는 활성 연 멤버가 있으면 ANNUAL, 아니면 CASUAL로 판정한다.
 * (requirements.md 4·7·19번 — 이름만/전화번호만 일치하는 경우는 CASUAL로 처리)
 */
export async function determineMemberType(
  name: string,
  phone: string,
  client: PrismaClientOrTx = prisma
): Promise<MemberTypeResult> {
  const normalizedName = normalizeName(name);
  const normalizedPhone = normalizePhone(phone);
  const phoneHash = hashPhone(normalizedPhone);

  const match = await client.annualMember.findFirst({
    where: { normalizedName, phoneHash, isActive: true },
    select: { id: true },
  });

  return match
    ? { memberType: "ANNUAL", matchedAnnualMemberId: match.id }
    : { memberType: "CASUAL", matchedAnnualMemberId: null };
}

/** 서비스가 외부로 반환하는 연 멤버 정보. phoneHash/phoneEncrypted는 절대 포함하지 않는다. */
function toAnnualMemberDTO(member: AnnualMember) {
  return {
    id: member.id,
    name: member.name,
    phone: decryptPhone(member.phoneEncrypted),
    isActive: member.isActive,
    memo: member.memo,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

/**
 * 연 멤버 등록(requirements.md 4번). normalizedName+phoneHash 조합 중복을 방지한다.
 */
export async function createAnnualMember(input: AnnualMemberInput) {
  const normalizedName = normalizeName(input.name);
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedName) {
    throw new ValidationError("이름을 입력해주세요.");
  }
  if (!normalizedPhone) {
    throw new ValidationError("전화번호를 입력해주세요.");
  }

  const phoneHash = hashPhone(normalizedPhone);
  const duplicate = await prisma.annualMember.findFirst({
    where: { normalizedName, phoneHash },
  });
  if (duplicate) {
    throw new ConflictError("이미 등록된 연 멤버입니다(이름+전화번호 중복).");
  }

  const created = await prisma.annualMember.create({
    data: {
      name: normalizedName,
      normalizedName,
      phoneHash,
      phoneEncrypted: encryptPhone(normalizedPhone),
      memo: input.memo?.trim() || null,
    },
  });
  return toAnnualMemberDTO(created);
}

/**
 * 연 멤버 수정. 이름/전화번호를 바꾸면 새 조합으로 중복 여부를 다시 검사한다.
 * 전화번호를 바꾸지 않으면 기존 phoneHash/phoneEncrypted를 그대로 유지한다(재계산 불필요).
 */
export async function updateAnnualMember(id: string, input: AnnualMemberUpdateInput) {
  const existing = await prisma.annualMember.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("연 멤버를 찾을 수 없습니다.");
  }

  let normalizedName = existing.normalizedName;
  if (input.name !== undefined) {
    normalizedName = normalizeName(input.name);
    if (!normalizedName) {
      throw new ValidationError("이름을 입력해주세요.");
    }
  }

  let phoneHash = existing.phoneHash;
  let phoneEncrypted = existing.phoneEncrypted;
  if (input.phone !== undefined) {
    const normalizedPhone = normalizePhone(input.phone);
    if (!normalizedPhone) {
      throw new ValidationError("전화번호를 입력해주세요.");
    }
    phoneHash = hashPhone(normalizedPhone);
    phoneEncrypted = encryptPhone(normalizedPhone);
  }

  if (input.name !== undefined || input.phone !== undefined) {
    const duplicate = await prisma.annualMember.findFirst({
      where: { normalizedName, phoneHash, NOT: { id } },
    });
    if (duplicate) {
      throw new ConflictError("이미 등록된 연 멤버입니다(이름+전화번호 중복).");
    }
  }

  const updated = await prisma.annualMember.update({
    where: { id },
    data: {
      name: normalizedName,
      normalizedName,
      phoneHash,
      phoneEncrypted,
      memo: input.memo !== undefined ? input.memo?.trim() || null : undefined,
      isActive: input.isActive,
    },
  });
  return toAnnualMemberDTO(updated);
}

/**
 * 하드 삭제 없음(decisions.md D-07). "삭제" 액션은 isActive=false 처리만 한다.
 * 비활성화 후에는 determineMemberType/자동 배정 대상에서 모두 제외된다.
 */
export async function deactivateAnnualMember(id: string) {
  const existing = await prisma.annualMember.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("연 멤버를 찾을 수 없습니다.");
  }
  const updated = await prisma.annualMember.update({ where: { id }, data: { isActive: false } });
  return toAnnualMemberDTO(updated);
}

/** 관리자용 연 멤버 목록. 전화번호는 이 함수에서만 복호화한다. */
export async function listAnnualMembers(filter: ListAnnualMembersFilter = {}) {
  const members = await prisma.annualMember.findMany({
    where: { isActive: filter.isActive },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return members.map(toAnnualMemberDTO);
}
