import { NextRequest } from "next/server";
import { withApiHandler, jsonOk } from "@/lib/http";
import { verifySessionFromRequest } from "@/lib/services/adminAuthService";
import { prisma } from "@/lib/db/prisma";
import { decryptPhone } from "@/lib/security/phoneCrypto";
import { ensureParticipantCodesBatch, countParticipantCodes } from "@/lib/services/participantCodeService";

/**
 * 1회성 임시 라우트 — 사용 후 반드시 제거한다.
 *
 * scripts/backfill-participant-codes.ts와 같은 목적(기존 예약자/연 멤버에게 코드 소급 발급)이지만,
 * 그 스크립트는 로컬에서 실행해야 하는데 PII_SECRET_KEY/TURSO_AUTH_TOKEN 등이 Vercel에서
 * "Sensitive" 환경변수로 설정돼 있어 값을 다시 읽어올 방법이 없다(생성자도 조회 불가, 빌드/런타임
 * 주입 전용). 이 값들은 프로덕션 런타임에는 이미 주입돼 있으므로, 관리자 인증을 거친 API 호출로
 * 같은 작업을 프로덕션 안에서 대신 실행한다.
 *
 * ensureParticipantCodesBatch를 그대로 재사용한다(스크립트처럼 phoneHash/phoneEncrypted를 직접
 * 복사하는 대신 복호화 후 재정규화/재해시하지만, 같은 마스터 키로 처리되므로 결과 식별 키는
 * 동일하다 — 멱등성 있음, 여러 번 호출해도 안전).
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  await verifySessionFromRequest(req);

  const before = await countParticipantCodes();

  const [bookings, annualMembers] = await Promise.all([
    prisma.booking.findMany({
      select: { normalizedName: true, phoneHash: true, phoneEncrypted: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.annualMember.findMany({
      select: { normalizedName: true, phoneHash: true, phoneEncrypted: true },
    }),
  ]);

  const identities = new Map<string, { name: string; phone: string }>();
  for (const row of [...bookings, ...annualMembers]) {
    const key = `${row.normalizedName} ${row.phoneHash}`;
    if (!identities.has(key)) {
      identities.set(key, { name: row.normalizedName, phone: decryptPhone(row.phoneEncrypted) });
    }
  }

  await ensureParticipantCodesBatch(Array.from(identities.values()));

  const after = await countParticipantCodes();
  return jsonOk({
    identitiesFound: identities.size,
    before,
    after,
    created: after - before,
  });
});
