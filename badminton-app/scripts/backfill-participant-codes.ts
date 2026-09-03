/**
 * 참여자 영구 식별 코드 백필 스크립트 (1회성, requirements.md 27.3번, decisions.md D-33)
 *
 * 이 기능 도입 이전에 이미 쌓인 참여자(과거 Booking, 기존 AnnualMember)에게 코드를 소급
 * 발급한다. 앱의 런타임 경로가 아니라 배포 후 수동으로 한 번 실행한다(deployment.md 2장).
 *
 *   npx tsx --env-file=.env scripts/backfill-participant-codes.ts
 *
 * 실행 환경에 DB 연결 환경변수(TURSO_DATABASE_URL / TURSO_AUTH_TOKEN, 로컬은 file:./dev.db)가
 * 설정되어 있어야 한다. phoneHash/phoneEncrypted는 기존 Booking/AnnualMember 행의 값을 그대로
 * 복사하므로 이 스크립트 자체는 PII_SECRET_KEY로 재계산하지 않는다(같은 마스터 키로 만들어진
 * 값이라 앱에서 그대로 조회/복호화된다). 멱등성이 있어 재실행해도 안전하다(이미 코드가 있는
 * 신원은 건너뛴다).
 */

import crypto from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * lib/db/prisma.ts의 싱글턴은 Next.js 런타임(경로 별칭 "@/") 전제라 스크립트에서 그대로
 * 재사용하기 어렵다. 연결 방식(libSQL 어댑터, 로컬 file: 상대경로 보정)은 동일하게 맞춘다.
 */
function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.TURSO_DATABASE_URL;
  if (!rawUrl) {
    throw new Error("TURSO_DATABASE_URL 환경변수가 설정되지 않았습니다.");
  }
  let url = rawUrl;
  const prefix = "file:";
  if (url.startsWith(prefix)) {
    const rawPath = url.slice(prefix.length);
    if (!path.isAbsolute(rawPath) && !rawPath.startsWith(":memory:")) {
      url = prefix + path.join(process.cwd(), "prisma", rawPath);
    }
  }
  const adapter = new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return new PrismaClient({ adapter });
}

/** participantCodeService.generateParticipantCode와 동일 규칙(12자 base64url 랜덤). */
function generateParticipantCode(): string {
  return crypto.randomBytes(9).toString("base64url");
}

interface Identity {
  normalizedName: string;
  phoneHash: string;
  phoneEncrypted: string;
}

async function main() {
  const prisma = createPrismaClient();
  try {
    // 1) 과거 예약자. 같은 신원의 행이 여러 개면 가장 최근 행의 phoneEncrypted를 대표값으로
    //    쓴다(가장 최근에 실제로 쓰인 암호문이므로 복호화 시 항상 유효).
    const bookings = await prisma.booking.findMany({
      select: { normalizedName: true, phoneHash: true, phoneEncrypted: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const identities = new Map<string, Identity>();
    const keyOf = (normalizedName: string, phoneHash: string) => `${normalizedName} ${phoneHash}`;

    for (const booking of bookings) {
      const key = keyOf(booking.normalizedName, booking.phoneHash);
      if (!identities.has(key)) {
        identities.set(key, {
          normalizedName: booking.normalizedName,
          phoneHash: booking.phoneHash,
          phoneEncrypted: booking.phoneEncrypted,
        });
      }
    }
    const bookingIdentityCount = identities.size;

    // 2) 연 멤버(활성/비활성 모두). 예약 이력이 없는 등록자도 코드를 받아야 한다.
    const annualMembers = await prisma.annualMember.findMany({
      select: { normalizedName: true, phoneHash: true, phoneEncrypted: true },
    });
    for (const member of annualMembers) {
      const key = keyOf(member.normalizedName, member.phoneHash);
      if (!identities.has(key)) {
        identities.set(key, {
          normalizedName: member.normalizedName,
          phoneHash: member.phoneHash,
          phoneEncrypted: member.phoneEncrypted,
        });
      }
    }

    // 3) 이미 발급된 조합 제외(멱등성).
    const existing = await prisma.participantCode.findMany({
      select: { normalizedName: true, phoneHash: true },
    });
    const existingKeys = new Set(existing.map((e) => keyOf(e.normalizedName, e.phoneHash)));

    const toCreate = Array.from(identities.entries())
      .filter(([key]) => !existingKeys.has(key))
      .map(([, identity]) => ({
        name: identity.normalizedName,
        normalizedName: identity.normalizedName,
        phoneHash: identity.phoneHash,
        phoneEncrypted: identity.phoneEncrypted,
        code: generateParticipantCode(),
      }));

    // 4) 일괄 생성.
    if (toCreate.length > 0) {
      await prisma.participantCode.createMany({ data: toCreate });
    }

    // 5) 요약 출력.
    console.log("[backfill-participant-codes] 완료");
    console.log(`  - 과거 예약(Booking)에서 찾은 고유 신원: ${bookingIdentityCount}건`);
    console.log(`  - 연 멤버(AnnualMember) 포함 후 고유 신원 합계: ${identities.size}건`);
    console.log(`  - 이미 코드가 있어 건너뜀: ${identities.size - toCreate.length}건`);
    console.log(`  - 신규 발급: ${toCreate.length}건`);
    console.log(`  - 현재 ParticipantCode 총 건수: ${await prisma.participantCode.count()}건`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[backfill-participant-codes] 실패", err);
  process.exit(1);
});
