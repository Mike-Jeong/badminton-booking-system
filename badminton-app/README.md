# 배드민턴 예약 관리 시스템 (Phase 0 + Phase 1 + Phase 2 + Phase 3)

이 디렉토리는 프로젝트 루트의 `requirements.md` / `architecture.md` / `decisions.md` /
`deployment.md` / `roadmap.md` / `qa-checklist.md`에 정의된 스펙을 기준으로 구현한
Next.js 애플리케이션이다. 현재 범위는 `roadmap.md` **Phase 0(프로젝트 셋업)** +
**Phase 1(관리자 인증 + 예약일 CRUD)** + **Phase 2(사용자 예약 신청 + 자동승인/대기)** +
**Phase 3(예약 취소 + 대기 자동승격)** 까지다.

## 검증 완료

`npm install`, `npx tsc --noEmit`, `npm run build`, `npx prisma migrate dev`를 Node 20
환경에서 실제로 실행해 통과를 확인했다(Node 18.18+ 필요 — Next.js 15 요구사항). 이 과정에서
발견해 수정한 이슈:

- `prisma/schema.prisma`의 `previewFeatures = ["driverAdapters"]`가 실제로 deprecated
  경고를 발생시켜 제거했다.
- `@libsql/client`의 네이티브 바이너리/문서 파일을 webpack이 파싱하려다 빌드가 실패해,
  `next.config.ts`에 `serverExternalPackages`를 추가했다.
- `lib/db/prisma.ts`: `prisma migrate`는 상대 SQLite 경로를 `schema.prisma` 위치
  (`prisma/`) 기준으로 해석하지만, libsql 런타임 어댑터는 `process.cwd()` 기준으로
  해석해 서로 다른 파일을 보는 문제가 있어 경로를 정규화했다.
- `lib/auth/session.ts`: TypeScript 5.7+ 환경에서 `Uint8Array<ArrayBufferLike>` vs
  `BufferSource` 타입 불일치를 제네릭 타입 인자로 수정했다.

## 실행 방법

```bash
# 1. 의존성 설치 (postinstall에서 prisma generate 자동 실행)
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env를 열어 아래 값을 채운다:
#   ADMIN_PASSWORD            - 관리자 로그인 비밀번호(평문)
#   ADMIN_SESSION_SECRET      - 임의의 긴 랜덤 문자열 (예: openssl rand -base64 32)
#   TURSO_DATABASE_URL        - 로컬 개발은 file:./dev.db 그대로 두면 됨
#   TURSO_AUTH_TOKEN          - 로컬 파일 DB에는 불필요(빈 값으로 둬도 됨)
#   PII_SECRET_KEY            - openssl rand -base64 32 로 생성한 32바이트 이상 base64 값

# 3. 로컬 SQLite(dev.db)에 스키마 생성
npx prisma migrate dev --name init

# 4. 개발 서버 실행
npm run dev
```

개발 서버가 뜨면:
- `http://localhost:3000/` — 공개 예약일 목록 (isOpen=true만 노출)
- `http://localhost:3000/booking-days/[id]` — 예약일 상세 + 예약 신청 폼
- `http://localhost:3000/lookup` — 전화번호로 내 예약 조회/취소
- `http://localhost:3000/admin/login` — 관리자 로그인
- `http://localhost:3000/admin/booking-days` — 로그인 후 예약일 목록/생성
- `http://localhost:3000/admin/booking-days/[id]` — 예약일 상세/수정/삭제 + 예약자 관리(승인/취소/수동추가)

## 이번 범위(Phase 0+1+2+3)에 포함된 것

- Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui 스타일 컴포넌트(수동 작성)
- Prisma 스키마 전체(AnnualMember/MonthlyMember/BookingDay/Booking) — Phase 4 이후에
  쓰일 모델도 architecture.md 3장 그대로 포함되어 있다.
- `@prisma/adapter-libsql` + `@libsql/client` 기반 DB 연결(`lib/db/prisma.ts`)
- `lib/security/phoneCrypto.ts`(hashPhone/encryptPhone/decryptPhone, HKDF 서브키 파생)
- `lib/normalize.ts`, `lib/timezone.ts`(Pacific/Auckland, IANA 타임존 기반, 외부
  날짜 라이브러리 없이 Intl API로 구현)
- `lib/auth/session.ts`(Web Crypto API 기반 서명 쿠키, edge/node 겸용)
- `lib/services/adminAuthService.ts`, `bookingDayService.ts`(슬롯 증가 시 대기자
  자동승격 연계 + 슬롯 초과 경고 포함), `bookingService.ts`(createBooking/cancelBooking/
  lookupBookingsByPhone/promoteWaitingBookings/관리자 예약 운영), `annualMemberService.ts`
  (determineMemberType만 — 연 멤버 CRUD/관리 UI는 Phase 4)
- `middleware.ts`(관리자 라우트 보호)
- API: 관리자 인증/예약일 CRUD(Phase 1) + `/api/bookings`, `/api/bookings/lookup`,
  `/api/bookings/[id]/cancel`(공개), `/api/admin/bookings`,
  `/api/admin/bookings/[id]`, `/api/admin/bookings/[id]/cancel`,
  `/api/admin/booking-days/[id]/bookings`(관리자)
- 화면: 공개 예약 신청/조회/취소 플로우 전체, 관리자 예약 승인/취소/수동추가 패널

## 이번 범위에 포함되지 않은 것 (Phase 4 이후)

연/월 멤버 관리 CRUD·UI, 월 멤버 자동 배정, 관리자 대시보드는 `roadmap.md` Phase 4~5
범위이며 아직 포함되지 않았다. 연 멤버 테스트 데이터가 필요하면 Prisma Studio
(`npm run db:studio`)로 직접 입력한다(`determineMemberType`은 이미 동작하므로 연 멤버를
등록해두면 예약 신청 시 자동으로 ANNUAL로 판정된다).
