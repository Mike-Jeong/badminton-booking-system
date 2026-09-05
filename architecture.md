# 배드민턴 예약 관리 시스템 — 기술 아키텍처 문서

기준 문서: `requirements.md`(21번 기술 스택), `기획서.md`
작성 관점: 아키텍트 — "무엇을 만들지"가 아니라 "이미 확정된 로직을 어떤 구조로 구현할지"만 다룬다.
주의: 이 문서는 요구사항의 비즈니스 규칙을 바꾸지 않는다. 규칙이 문서와 다르게 보이면 이 문서가 아니라 `requirements.md`가 맞다.
배포(호스팅/환경변수/마이그레이션 운영) 관련 내용은 이 문서에 두지 않고 `deployment.md`에서 별도 관리한다(decisions.md D-12).

---

## 1. 전체 디렉토리 구조

Next.js App Router 기준. MVP 규모에 맞춘 단순 구조이며, 마이크로서비스/큐/이벤트 버스 등은 사용하지 않는다.

```
app/
  (public)/
    page.tsx                          # 공개 예약일 목록 (isOpen=true만)
    booking-days/[id]/page.tsx        # 예약일 상세 + 신청 폼 + 예약자 이름/상태 목록
    lookup/page.tsx                   # 전화번호로 내 예약 조회 → 취소 선택
    layout.tsx
  admin/
    layout.tsx                        # 관리자 공통 레이아웃 (로그인 여부는 middleware가 이미 보장)
    login/page.tsx
    dashboard/page.tsx
    booking-days/page.tsx
    booking-days/[id]/page.tsx        # 예약자 목록(전체 정보) + 상태변경 + 자동배정 버튼
    annual-members/page.tsx
    monthly-members/page.tsx
    club-day-patterns/page.tsx        # 클럽데이 패턴 목록/등록/수정/비활성화/삭제 (신규, requirements.md 25번)
    participant-codes/page.tsx        # 참여자 코드 목록(코드/이름/전화번호) + 내보내기 제외 토글 + 최근 내보내기
                                       # 이력 + CSV 다운로드 버튼 (신규, requirements.md 27번, decisions.md D-34
                                       # 개정 1·2). 등록/수정/삭제 같은 일반 CRUD는 없다(파생 데이터, YAGNI) —
                                       # 유일한 쓰기 액션은 제외 토글뿐이라 다른 관리 화면과는 성격이 다르다
  api/
    booking-days/route.ts             # GET (공개 목록)
    booking-days/[id]/route.ts        # GET (공개 상세)
    bookings/route.ts                 # POST (사용자 예약 신청)
    bookings/lookup/route.ts          # POST (전화번호로 조회)
    bookings/[id]/cancel/route.ts     # POST (사용자 취소)
    bookings/[id]/payment-proof/route.ts  # POST (사용자 셀프 결제증빙 업로드, 신규, requirements.md 26번)
    # bookings/route.ts, bookings/lookup/route.ts 응답 DTO에 participantCode 필드 추가(신규 라우트 아님,
    # 기존 응답 확장, requirements.md 27번)
    cron/club-days/route.ts           # GET (신규, Vercel Cron 전용, CRON_SECRET 헤더로 보호. /api/admin 바깥이라
                                       # 관리자 세션 미들웨어 대상이 아님 — 이 라우트 자체에서 인증 검증)
    admin/login/route.ts              # POST
    admin/logout/route.ts             # POST
    admin/booking-days/route.ts       # GET, POST
    admin/booking-days/[id]/route.ts  # GET, PATCH, DELETE
    admin/booking-days/[id]/bookings/route.ts               # GET (예약자 목록, 전체정보)
    admin/booking-days/[id]/apply-monthly-members/route.ts  # POST
    admin/bookings/route.ts           # POST (관리자 수동 예약 추가, source=ADMIN)
    admin/bookings/[id]/route.ts      # PATCH (상태 변경/승인)
    admin/bookings/[id]/cancel/route.ts # POST (관리자 취소 처리)
    admin/bookings/[id]/payment-proof/route.ts       # GET, POST (신규, 이미지 조회/대리 업로드, requirements.md 26번)
    admin/bookings/[id]/payment-confirmation/route.ts # PATCH (신규, 확인/확인취소, requirements.md 26번)
    admin/annual-members/route.ts     # GET, POST
    admin/annual-members/[id]/route.ts # PATCH, DELETE
    admin/monthly-members/route.ts    # GET, POST
    admin/monthly-members/[id]/route.ts # PATCH, DELETE
    admin/monthly-members/apply/route.ts # POST (연/월[/요일] 일괄 자동배정)
    admin/club-day-patterns/route.ts       # GET, POST (신규)
    admin/club-day-patterns/[id]/route.ts  # PATCH(수정/비활성화·활성화), DELETE(소프트 삭제) (신규)
    admin/participant-codes/route.ts         # GET, 목록 + 총 건수 + 최근 내보내기 이력 (신규, requirements.md 27.5번)
    admin/participant-codes/export/route.ts  # GET, CSV 다운로드 + 내보내기 이력 기록 (신규, requirements.md 27.5번)
    admin/participant-codes/[id]/route.ts    # PATCH(excludedFromExport 토글)/DELETE(완전 삭제) (신규, requirements.md 27.5.2·27.5.4번)
    admin/dashboard/route.ts          # GET
  layout.tsx
  globals.css

lib/
  db/
    prisma.ts                # PrismaClient 싱글턴, PrismaLibSQL 어댑터로 Turso 연결 (개발 모드 hot-reload 대응)
  services/
    adminAuthService.ts      # 로그인 검증, 세션 발급/검증/로그아웃
    bookingDayService.ts     # 예약일 CRUD, dayOfWeek 자동계산, 슬롯 검증/변경
    bookingService.ts        # createBooking, cancelBooking, lookupBookingsByPhone,
                              # promoteWaitingBookings, 관리자 상태변경/수동추가
    annualMemberService.ts   # 연 멤버 CRUD, determineMemberType
    monthlyMemberService.ts  # 월 멤버 CRUD, applyMonthlyMembersToBookingDay/ToMonth
    dashboardService.ts      # 대시보드 집계
    clubDayPatternService.ts     # 클럽데이 패턴 CRUD (신규, requirements.md 25번)
    clubDayGenerationService.ts  # generateUpcomingClubDays — 크론이 호출하는 생성 로직 (신규)
    paymentProofService.ts       # isPaymentConfirmationRequired(단건/배치), uploadPaymentProof,
                                  # getPaymentProof, setPaymentConfirmation (신규, requirements.md 26번,
                                  # decisions.md D-31·D-32)
    participantCodeService.ts    # ensureParticipantCode(단건)/ensureParticipantCodesBatch(배치),
                                  # listParticipantCodesForExport (신규, requirements.md 27번, decisions.md D-33·D-34)
  validation/
    bookingSlots.ts             # assertTimeRange/validateSlots — bookingDayService.ts에서 추출해 공유
                                 # (신규, clubDayPatternService도 동일 검증 규칙을 재사용하기 위함)
  normalize.ts                # normalizeName, normalizePhone
  timezone.ts                  # Pacific/Auckland 관련 유틸(오늘 날짜, dayOfWeek 계산,
                                # formatDateTimeInTimeZone — 이벤트 발생 시각 "YYYY-MM-DD HH:mm" 표시용)
  imageCompression.ts          # compressImageFile — 클라이언트 전용(브라우저 Canvas/Image API),
                                # 결제증빙 업로드 전 리사이즈/재인코딩 (신규, decisions.md D-32,
                                # 새 npm 의존성 없음)
  localBookingIdentity.ts      # loadSavedIdentity/saveIdentity — 예약 폼 마지막 입력값(이름/전화번호)
                                # localStorage 캐싱, BookingForm·CancelLookup 공유 (신규, requirements.md 27.6번)
  security/
    phoneCrypto.ts             # hashPhone(HMAC-SHA256), encryptPhone/decryptPhone(AES-256-GCM), PII_SECRET_KEY 기반
  auth/
    session.ts                # 쿠키 서명(sign)/검증(verify), payload 정의
    cronAuth.ts                # assertCronSecret(req) — CRON_SECRET Authorization 헤더 검증 (신규)
  errors.ts                    # AppError 및 하위 에러 클래스, 응답 포맷터
  http.ts                      # route handler 공통 wrapper(try/catch → 응답 포맷)

components/
  ui/                          # shadcn/ui 컴포넌트 (button, input, table, dialog 등)
  admin/                       # 관리자 화면 전용 컴포넌트
    ParticipantCodesPanel.tsx  # 참여자 코드 목록 테이블 + 행별 "내보내기 제외" 토글 + "삭제" + 최근 내보내기
                                # 이력 표시 (신규, requirements.md 27.5번, decisions.md D-34 개정 1·2).
                                # AnnualMembersPanel과 동일한 클라이언트 컴포넌트 패턴(목록은 서버
                                # 컴포넌트가 props로 전달, 토글 액션만 fetch + router.refresh())
  public/                      # 사용자 화면 전용 컴포넌트
    ParticipantQrButton.tsx    # "QR 저장하기" 버튼. code(string) prop을 받아 클릭 시 qrcode를
                                # 동적 임포트해 PNG로 렌더링 후 다운로드 (신규, requirements.md 27.4번,
                                # decisions.md D-35). BookingForm/CancelLookup 양쪽에서 재사용

middleware.ts                  # /admin/*, /api/admin/* 보호 (로그인 라우트 제외)

prisma/
  schema.prisma
  migrations/

scripts/
  backfill-participant-codes.ts  # 1회성 백필 스크립트 (신규, requirements.md 27.3번, decisions.md D-33).
                                  # 기존 Booking/AnnualMember 데이터로부터 참여자 코드를 소급 발급한다.
                                  # 앱 실행 경로가 아니므로 수동으로 1회 실행한다(아래 2장 서비스 설명,
                                  # deployment.md 2장 참고)

.env                            # ADMIN_PASSWORD, ADMIN_SESSION_SECRET,
                                 # TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, PII_SECRET_KEY, CRON_SECRET

vercel.json                    # crons 설정 (신규, deployment.md 참고)
```

배포는 Vercel(Hobby, 무료) + Turso(무료 티어)를 사용한다(확정, decisions.md D-09). Docker/자체 서버 배포는 사용하지 않으므로 `Dockerfile`/`docker-compose.yml`은 두지 않는다. 자세한 내용은 `deployment.md` 참고.

`package.json`에 신규 의존성 `qrcode`(dependencies)와 `@types/qrcode`(devDependencies)를 추가한다(decisions.md D-35). 이 프로젝트에 QR 관련 패키지가 추가되는 것은 이번이 처음이다(미병합 `feature/member-check-in-out` 브랜치의 `qrcode.react`는 `main` 기준 존재하지 않음).

---

## 2. 도메인별 Service 계층 분리안

`requirements.md` 19번(주요 서비스 함수)을 서비스 파일로 매핑한다. 각 서비스는 Prisma 호출만 담당하며, API 라우트는 요청 파싱/응답 변환만 수행하고 실제 로직은 서비스에 위임한다.

### AdminAuthService (`lib/services/adminAuthService.ts`)
- `login(password: string)`: 환경변수 `ADMIN_PASSWORD`와 비교 후 세션 payload 발급 (검토했던 해시 방식은 decisions.md D-11/D-13 참고 — MVP 규모에서는 평문 유지로 최종 결정)
- `verifySession(cookieValue: string)`: 서명/만료 검증
- `logout()`: 쿠키 무효화

### BookingDayService (`lib/services/bookingDayService.ts`)
- `createBookingDay(input)`: dayOfWeek 자동 계산(Pacific/Auckland 기준), slotMode별 슬롯 합 검증, 생성 후 `applyMonthlyMembersToBookingDay` 호출
- `updateBookingDay(id, input)`: 슬롯 수 변경 시 `promoteWaitingBookings` 호출. 새 슬롯 수(분리 모드면 `annualSlots`/`casualSlots` 각각)가 현재 확정(CONFIRMED) 인원보다 작으면 `ValidationError`로 저장 자체를 거부한다(decisions.md D-15, 강제 하향 없음)
- `deleteBookingDay(id)`
- `listBookingDays(filter)` / `getBookingDayById(id)`

### BookingService (`lib/services/bookingService.ts`)
- `determineMemberType(name, phone)` — 실제로는 연 멤버 조회가 필요하므로 AnnualMemberService에 위치(아래 참고). BookingService는 이 결과를 소비만 한다.
- `createBooking(bookingDayId, name, phone, source)` — 저장 전 `phoneCrypto.hashPhone`/`encryptPhone`으로 변환, 평문 phone은 저장하지 않음
- `cancelBooking(bookingId, phone)` — 입력 전화번호를 `hashPhone`으로 변환해 저장된 `phoneHash`와 비교(복호화 없음)
- `lookupBookingsByPhone(phone)` — `hashPhone`으로 변환 후 `phoneHash` 일치 조회(복호화 없음)
- `promoteWaitingBookings(bookingDayId)`
- `adminChangeBookingStatus(bookingId, status)` — 대기→확정 승인. 슬롯 여유와 무관하게 항상 성공하며, 부족하면 예약일의 슬롯 수(분리 모드면 해당 memberType의 세부 슬롯 + totalSlots)를 자동 확장한다(decisions.md D-14, 관리자 액션 한정)
- `adminCreateBooking(bookingDayId, name, phone)` — source=ADMIN. determineMemberType은 동일하게 수행하되, 슬롯이 부족하면 adminChangeBookingStatus와 동일하게 자동 확장 후 확정 처리한다(D-14)
- `adminCancelBooking(bookingId)` — 전화번호 검증 없이 관리자 권한으로 취소, 승격 로직은 사용자 취소와 동일하게 호출

### AnnualMemberService (`lib/services/annualMemberService.ts`)
- `determineMemberType(name, phone)`: 정규화 → `hashPhone` 변환 → 활성 연 멤버 중 `normalizedName + phoneHash` 일치 조회 → ANNUAL/CASUAL 판정 (createBooking, applyMonthlyMembersToBookingDay 양쪽에서 재사용). 복호화가 필요 없다.
- `createAnnualMember(input)` / `updateAnnualMember(id, input)` / `deactivateAnnualMember(id)` — 저장 시 `phoneHash`/`phoneEncrypted` 계산
- `listAnnualMembers(filter)`
- 하드 삭제 없음(확정, decisions.md D-07). 관리자 화면의 "삭제" 액션은 `deactivateAnnualMember`를 호출해 `isActive=false`로만 처리한다.

### MonthlyMemberService (`lib/services/monthlyMemberService.ts`)
- `createMonthlyMember(input)` / `createMonthlyMembersBulk(input)` / `updateMonthlyMember(id, input)` / `deleteMonthlyMember(id)`
- `listMonthlyMembers(filter)` — 연/월 단위 필터
- `applyMonthlyMembersToBookingDay(bookingDayId)` — 대상 월 멤버/기존 예약/확정 인원 수를 각각 한 번씩만 배치 조회하고 `createMany`로 한 번에 insert한다(월 멤버 수와 무관하게 쿼리 수 O(1)). 이전에는 멤버마다 조회/생성 쿼리를 순차 실행해(O(N)) 월 멤버 수가 많을 때 Prisma 트랜잭션 기본 타임아웃(5초)을 넘겨 500 에러가 나는 문제가 있었다 — 단독 호출 시 트랜잭션 타임아웃도 15초로 늘려 방어적 여유를 뒀다(보조 수단).
- 비활성화(`isActive=false`)는 `updateMonthlyMember`로, 완전 삭제(하드 삭제)는 `deleteMonthlyMember`로 별도 제공한다(decisions.md D-26 — MonthlyMember는 Booking 등 다른 레코드가 FK로 참조하지 않아, AnnualMember와 달리 D-07의 "하드 삭제 없음" 원칙을 적용할 이유가 없다). 특정 멤버를 특정 요일 자동 배정에서 영구 제외하고 싶을 때는 비활성화로 처리한다(D-08).
- `createMonthlyMembersBulk`는 여러 요일을 한 번에 등록할 때 쓰며, 요일별로 `createMonthlyMember`를 호출해 일부 요일이 중복이어도 나머지는 정상 등록되는 부분 성공을 허용한다(decisions.md D-25).

### ClubDayPatternService (`lib/services/clubDayPatternService.ts`, 신규)
- `createClubDayPattern(input)`: `dayOfWeek`(0~6) 검증, `lib/validation/bookingSlots.ts`의 `assertTimeRange`/`validateSlots`를 재사용해 시간·슬롯 검증(`bookingDayService.createBookingDay`와 동일 규칙). `isActive` 기본값 `true`, `autoAssignMonthlyMembers` 기본값 `true`(decisions.md D-30).
- `updateClubDayPattern(id, input)`: 전달된 필드만 갱신(부분 업데이트). `isActive` 토글도 이 함수로 처리한다(별도 activate/deactivate 함수 없음, `updateMonthlyMember`와 동일 패턴).
- `deleteClubDayPattern(id)`: **물리적 삭제 없음**(decisions.md D-29). `deletedAt = new Date()`, `isActive = false`를 저장한다. `prisma.clubDayPattern.delete(...)`는 호출하지 않는다.
- `listClubDayPatterns()`: 기본적으로 `deletedAt: null`인 패턴만 반환(삭제된 패턴은 목록에서 제외). 삭제된 패턴을 다시 조회하는 옵션은 이번 범위에 포함하지 않는다(YAGNI, 필요 시 추후 추가).
- 검증 로직(시간 범위, 슬롯 합)을 중복 구현하지 않기 위해, `bookingDayService.ts`에 있던 private 함수 `assertTimeRange`/`validateSlots`를 `lib/validation/bookingSlots.ts`로 추출해 `export`하고, `bookingDayService.ts`와 `clubDayPatternService.ts` 양쪽에서 import해 사용하도록 리팩터링한다.

### ClubDayGenerationService (`lib/services/clubDayGenerationService.ts`, 신규)
- `generateUpcomingClubDays(now: Date = new Date())`: 크론(`GET /api/cron/club-days`)이 호출하는 핵심 함수(decisions.md D-27 개정 전 이름은 `generateTodaysClubDays`였다).
  1. `formatDateOnlyInTimeZone(now)`(`lib/timezone.ts`)로 실행 시점의 Pacific/Auckland 기준 "오늘" 날짜를 구하고, `addDaysToDateOnly(..., 2)`로 2일을 더해 생성 대상 날짜("모레")를 계산한 뒤 `getDayOfWeekForDateOnly`로 그 날짜의 요일을 구한다(decisions.md D-27 개정 — 회원이 예약할 시간을 최소 이틀 확보).
  2. `prisma.clubDayPattern.findMany({ where: { isActive: true, deletedAt: null, dayOfWeek: targetDayOfWeek } })`로 대상 날짜(모레)에 대해 생성할 패턴을 조회한다.
  3. 패턴마다 **개별 `prisma.$transaction`**을 열어(패턴 간 격리, 7장 트랜잭션 원칙과 동일) 다음을 수행한다:
     - `tx.bookingDay.findFirst({ where: { clubDayPatternId: pattern.id, date: targetUtcMidnight } })`로 이미 생성됐는지 확인(decisions.md D-28). 있으면 `{ status: "skipped" }`로 종료.
     - 없으면 패턴의 필드값을 그대로 복사해 `tx.bookingDay.create(...)` — `isOpen: true` 고정, `clubDayPatternId: pattern.id` 설정. 여기서는 `bookingDayService.createBookingDay`를 재사용하지 않는다(그 함수는 트랜잭션 인자를 받지 않아 이 단계의 원자성 요구와 맞지 않음). 패턴 필드는 이미 등록/수정 시점에 검증됐으므로 생성 시점에 재검증하지 않는다.
     - `pattern.autoAssignMonthlyMembers`가 `true`면 `applyMonthlyMembersToBookingDay(bookingDay.id, tx)`를 같은 트랜잭션에서 호출(기존 함수가 이미 `tx` 인자를 지원하므로 그대로 재사용).
     - `{ status: "created", bookingDayId }`로 종료.
  4. 패턴별 결과 배열(`{ patternId, status: "created" | "skipped" | "failed", bookingDayId?, error? }`)을 반환한다. 한 패턴 처리 중 예외가 발생해도 `try/catch`로 감싸 `status: "failed"`로 기록하고 다음 패턴 처리를 계속한다(한 패턴의 실패가 다른 패턴에 영향을 주지 않음).

### DashboardService (`lib/services/dashboardService.ts`)
- `getTodaySummary()` — Pacific/Auckland 기준 "오늘"
- `getSummaryByDateRange(from, to)` — 날짜별 확정/대기/취소 인원, 슬롯 사용률, 대기 인원 발생 경고
  플래그(`WAITING` 존재 여부). "슬롯 초과" 대신 이 지표를 쓰는 이유는 decisions.md D-16 참고 —
  D-14/D-15 이후 앱의 정상 동작으로는 슬롯 초과 상태 자체가 발생하지 않는다.

### PaymentProofService (`lib/services/paymentProofService.ts`, 신규, requirements.md 26번)
- `isPaymentConfirmationRequired(booking, bookingDay, client)`: 단건 판정. `booking.memberType !== "ANNUAL"` 이거나 `matchedAnnualMemberId`가 없으면 즉시 `true`. `ANNUAL`이면 `client.monthlyMember.findFirst({ where: { annualMemberId: booking.matchedAnnualMemberId, isActive: true, year, month, dayOfWeek: bookingDay.dayOfWeek } })`를 조회해(연/월은 `formatDateOnlyInTimeZone(bookingDay.date)`를 파싱) 존재 여부의 역(`!found`)을 반환한다.
- `batchComputePaymentConfirmationRequirements(bookings, client)`: N+1 회피용 배치 버전. 월 멤버 자동 배정 성능 개선(architecture.md `MonthlyMemberService` 항목 참고)과 동일한 이유로, 이 함수 하나로 목록 조회 경로 전체를 처리한다.
  - `listBookingsForAdmin(bookingDayId)`처럼 **같은 `bookingDayId`의 예약 목록**을 다룰 때는 `bookingDay`가 하나뿐이므로 (연도, 월, 요일)을 한 번만 계산하고, 대상 `matchedAnnualMemberId` 집합에 대해 `monthlyMember.findMany`를 **단 1회** 호출해 일치 집합(Set)을 만든 뒤 각 예약을 메모리에서 판정한다.
  - `lookupBookingsByPhone(phone)`처럼 **여러 `bookingDay`에 걸친 예약 목록**을 다룰 때는, 관련된 `matchedAnnualMemberId` 전체에 대해 `monthlyMember.findMany({ where: { annualMemberId: { in: ids }, isActive: true } })`를 1회 호출해 `Map<annualMemberId, Set<"year-month-dayOfWeek">>`를 만든 뒤, 각 예약을 자신의 `bookingDay`의 (연도, 월, `dayOfWeek`)로 메모리에서 조회한다(예약 건수와 무관하게 쿼리 수는 O(1)).
- `uploadPaymentProof(bookingId, file, uploadedBy, phone?)`: `uploadedBy === "SELF"`면 `phoneHash` 검증(취소와 동일 패턴) 후 진행, `"ADMIN"`이면 생략. `CANCELLED` 예약은 거부(`ConflictError`). `isBookingDayEnded`는 검사하지 않는다(requirements.md 26.3). MIME 타입(jpeg/png/webp)과 2MB 상한을 검증(`ValidationError`). `prisma.paymentProof.upsert({ where: { bookingId }, ... })`로 기존 증빙을 교체하거나 새로 생성한다.
- `getPaymentProof(bookingId)`: 관리자 전용 조회. `PaymentProof`가 없으면 `NotFoundError`, 있으면 `{ imageDataUrl: \`data:${mimeType};base64,${imageData}\`, uploadedBy, updatedAt }`을 반환한다. `Booking`을 조회하는 다른 함수들과 달리 이미지가 필요할 때만 명시적으로 호출된다(decisions.md D-31 — `Booking`과 분리한 이유).
- `setPaymentConfirmation(bookingId, confirmed)`: 관리자 전용. `booking.paymentConfirmed`/`paymentConfirmedAt`을 갱신(확인 취소 시 `paymentConfirmedAt: null`). 증빙 이미지 유무를 검사하지 않는다.

### ParticipantCodeService (`lib/services/participantCodeService.ts`, 신규, requirements.md 27번, decisions.md D-33·D-34)
- `generateParticipantCode()`(모듈 내부 private 함수): `crypto.randomBytes(9).toString("base64url")`로 12자 랜덤 문자열을 만든다. 새 npm 의존성 없이 Node 내장 `crypto`만 사용(`lib/security/phoneCrypto.ts`와 같은 방식).
- `ensureParticipantCode(name, phone, client = prisma)`:
  1. `normalizeName`/`normalizePhone`으로 정규화 후 `hashPhone`으로 `phoneHash` 계산.
  2. `client.participantCode.findUnique({ where: { normalizedName_phoneHash: { normalizedName, phoneHash } } })`로 기존 레코드 조회.
  3. 있으면: 기존 행을 갱신 없이 그대로 반환(`{ code: existing.code, id: existing.id }`). `name`은 신원 키(`normalizedName`)와 항상 같은 값으로만 생성되므로 갱신할 필요 자체가 없고, `phoneEncrypted`도 재암호화하지 않는다(`phoneHash` 일치로 평문 값이 이미 동일함이 보장되므로).
  4. 없으면: `code = generateParticipantCode()`로 `client.participantCode.create({ data: { name: normalizedName, normalizedName, phoneHash, phoneEncrypted: encryptPhone(normalizedPhone), code } })` 시도. Prisma 유니크 제약 위반 에러(`P2002`, 동시 요청으로 인한 레이스)를 잡으면 다시 2번 조회로 폴백해 기존 값을 반환하고, 그 외 에러는 그대로 던진다.
  5. `createBooking`/`adminCreateBooking`이 예약 생성과 **같은 트랜잭션**(`tx`) 안에서 이 함수를 호출하고, 반환된 `code`를 예약 응답 DTO에 `participantCode` 필드로 병합한다. `lookupBookingsByPhone`도 각 예약의 `normalizedName`(같은 조회 내에서는 `phoneHash`가 공통이므로 이름만 다르면 됨)로 배치 조회해 `participantCode`를 함께 내려준다(N+1 회피, `batchComputePaymentConfirmationRequirements`와 동일한 패턴).
- `ensureParticipantCodesBatch(participants: { name, phone }[], client)`: `applyMonthlyMembersToBookingDay`(월 멤버 자동 배정, 다건 처리) 전용 배치 버전.
  1. 각 참여자의 `normalizedName`/`phoneHash`를 계산하고 동일 신원 중복을 배치 내에서 먼저 제거.
  2. `client.participantCode.findMany({ select: { normalizedName: true, phoneHash: true } })`로 테이블 전체의 신원 키만 1회 조회해 메모리에서 대조한다. 참여자 수만큼 `OR` 조건을 쌓는 방식은 SQLite/libSQL의 표현식 트리 깊이 제한(약 100)에 걸려 대량 배치(프로덕션 백필 등, 신원 100개 이상)에서 `SQLITE_UNKNOWN: Expression tree is too large` 에러로 실패한 적이 있어(2026-09-06) 이 방식으로 교체했다. `ParticipantCode`는 예약 건수가 아니라 실제 참여 인원 수만큼만 존재하는 작은 테이블이라 전체 조회가 안전하다.
  3. 없는 조합만 모아 `client.participantCode.createMany({ data: [...] })`로 1회에 생성(각 행에 새 `code` 발급).
  4. 기존 행은 단건 경로와 동일하게 갱신 없이 그대로 둔다 — `name`이 신원 키의 일부라 애초에 갱신할 대상이 없다.
  5. 반환값은 호출자가 쓰지 않는다(코드 발급/재사용 자체가 목적). `applyMonthlyMembersToBookingDay`가 대상 월 멤버 목록을 이미 로드한 시점에 같은 트랜잭션에서 호출한다.
- `listParticipantCodesForExport()`: `prisma.participantCode.findMany({ where: { excludedFromExport: false }, orderBy: { name: "asc" } })` 후 각 행을 `{ code, name, phone: decryptPhone(phoneEncrypted) }`로 매핑해 반환. 관리자 CSV 내보내기(`GET /api/admin/participant-codes/export`)에서만 호출한다(decisions.md D-34 개정 1 — `excludedFromExport=true`인 행만 걸러내고, 그 외 필터는 없음).
- `listParticipantCodesForAdmin()`: `prisma.participantCode.findMany({ orderBy: { name: "asc" } })`(제외 필터 없이 전체) 후 각 행을 `{ id, code, name, phone: decryptPhone(phoneEncrypted), excludedFromExport }`로 매핑해 반환. 관리자 화면(`/admin/participant-codes`)의 목록 테이블 렌더링 전용 — `listParticipantCodesForExport`와 달리 `id`와 `excludedFromExport`를 포함해 토글 UI가 현재 상태를 표시하고 대상을 특정할 수 있게 한다.
- `setParticipantCodeExclusion(id, excludedFromExport)`: 관리자 전용. `prisma.participantCode.update({ where: { id }, data: { excludedFromExport } })`. 대상이 없으면 `NotFoundError`. `PATCH /api/admin/participant-codes/[id]`가 호출한다(decisions.md D-34 개정 1).
- `deleteParticipantCode(id)`: 관리자 전용. 대상 존재 확인(`NotFoundError`) 후 `prisma.participantCode.delete({ where: { id } })`로 하드 삭제. `DELETE /api/admin/participant-codes/[id]`가 호출한다(requirements.md 27.5.4번).
- `recordParticipantCodeExport(exportedCount)`: `prisma.participantCodeExportLog.create({ data: { exportedCount } })`(`exportedAt`은 `@default(now())`). `GET /api/admin/participant-codes/export` 핸들러가 `listParticipantCodesForExport()` 결과로 CSV 응답을 실제로 만든 직후에만 호출한다 — 화면 조회(`listParticipantCodesForAdmin`)에서는 호출하지 않는다(decisions.md D-34 개정 2).
- `listParticipantCodeExportLogs(limit = 5)`: `prisma.participantCodeExportLog.findMany({ orderBy: { exportedAt: "desc" }, take: limit })`. 관리자 화면이 최근 내보내기 이력을 표시할 때 사용(기본 최근 5건 — 화면에는 최소 1건만 노출해도 되지만, 서비스 함수 자체는 여러 건을 받을 수 있게 해 화면 쪽에서 "더보기" 없이 최근 이력을 몇 건 더 보여주고 싶어져도 API 변경 없이 대응 가능).
- `countParticipantCodes()`: `prisma.participantCode.count()`. 참여자 코드 총 발급 건수(제외 설정과 무관한 전체 수)를 가볍게 보여주기 위한 용도.

**백필 스크립트(`scripts/backfill-participant-codes.ts`, 신규)**
이 기능 도입 이전에 이미 쌓인 참여자(과거 `Booking`, 기존 `AnnualMember`)에게 코드를 소급 발급하는 1회성 스크립트. 앱의 런타임 경로가 아니라 배포 후 수동으로 한 번 실행한다(`npx tsx scripts/backfill-participant-codes.ts`, `PII_SECRET_KEY`/DB 연결 환경변수가 실행 환경에 설정되어 있어야 함).
1. `prisma.booking.groupBy`류 조회 대신, `prisma.booking.findMany({ select: { normalizedName: true, phoneHash: true, phoneEncrypted: true, createdAt: true }, orderBy: { createdAt: "desc" } })`로 전체를 가져와 애플리케이션 메모리에서 `normalizedName+phoneHash` 기준으로 그룹핑하고, 각 그룹의 첫 번째(= `createdAt` 내림차순 정렬이므로 가장 최근) 행의 `phoneEncrypted`를 대표값으로 사용한다(가장 최근에 실제로 쓰인 암호문이므로 복호화 시 항상 유효).
2. `prisma.annualMember.findMany({ select: { normalizedName: true, phoneHash: true, phoneEncrypted: true } })`(활성/비활성 모두 포함)를 추가로 조회해 1번 결과와 `normalizedName+phoneHash` 기준으로 합집합을 만든다(둘 다 없는 조합만 새로 등록).
3. `prisma.participantCode.findMany()`로 이미 발급된 조합을 조회해 제외한다(재실행해도 안전 — 멱등성).
4. 남은 조합마다 새 `code`를 생성해 `createMany`로 일괄 등록한다.
5. 처리 건수(신규 생성/이미 존재/건너뜀)를 콘솔에 요약 출력한다.

---

## 3. Prisma 스키마 초안

`requirements.md` 17번 데이터 모델을 Prisma 문법으로 변환한 것. 필드/의미는 그대로 유지하고 타입·제약·인덱스만 추가했다.

```prisma
// prisma/schema.prisma
// DB는 Turso(libSQL)를 사용하지만, libSQL은 SQLite 호환이므로 Prisma의 sqlite 커넥터를 그대로 사용한다.
// 실제 연결은 datasource의 url이 아니라 PrismaClient 생성 시 드라이버 어댑터(@prisma/adapter-libsql)로 이루어진다(deployment.md 참고).

datasource db {
  provider = "sqlite"
  url      = env("TURSO_DATABASE_URL") // prisma migrate diff 등 CLI 작업 시 참조용. 런타임 연결은 어댑터가 담당.
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"] // 사용 중인 Prisma 버전에서 여전히 필요한지 릴리즈 노트 확인 필요(6.x부터 안정화 진행 중)
}

enum MemberType {
  ANNUAL
  CASUAL
}

enum BookingStatus {
  WAITING
  CONFIRMED
  CANCELLED
}

enum BookingSource {
  USER
  ADMIN
  MONTHLY_MEMBER_AUTO
}

enum SlotMode {
  SEPARATED
  COMBINED
}

enum ProofUploadSource {
  SELF
  ADMIN
}

model AnnualMember {
  id              String   @id @default(cuid())
  name            String
  normalizedName  String
  phoneHash       String   // HMAC-SHA256(normalizedPhone, PII_SECRET_KEY 파생 키) — 조회/중복확인용, 평문 아님
  phoneEncrypted  String   // AES-256-GCM(normalizedPhone) — 관리자 열람 시에만 복호화
  isActive        Boolean  @default(true)
  memo            String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  monthlyMembers MonthlyMember[]
  bookings       Booking[] @relation("MatchedAnnualMember")

  @@unique([normalizedName, phoneHash])
}

model MonthlyMember {
  id             String   @id @default(cuid())
  annualMemberId String
  annualMember   AnnualMember @relation(fields: [annualMemberId], references: [id])
  year           Int
  month          Int
  dayOfWeek      Int       // 0(일)~6(토), JS Date.getDay() 규칙과 동일하게 서버가 관리
  isActive       Boolean   @default(true)
  memo           String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([annualMemberId, year, month, dayOfWeek])
  @@index([year, month, dayOfWeek])
}

model ClubDayPattern {
  id                       String   @id @default(cuid())
  name                     String?  // 관리자 식별용, 예: "월요일 A체육관 저녁"
  dayOfWeek                Int      // 0(일)~6(토). 요일당 여러 패턴 등록 가능 (unique 제약 없음)
  label                    String?  // 생성되는 BookingDay.label에 그대로 복사
  startTime                String   // "HH:mm"
  endTime                  String   // "HH:mm", startTime보다 늦어야 함
  location                 String
  dutyPerson               String
  totalSlots               Int
  annualSlots              Int      @default(0)
  casualSlots              Int      @default(0)
  slotMode                 SlotMode
  autoAssignMonthlyMembers Boolean  @default(true)  // decisions.md D-30
  isActive                 Boolean  @default(true)  // 크론 생성 대상 여부(토글 가능)
  deletedAt                DateTime?                // "삭제" 액션 시각. null이 아니면 목록에서 숨김(decisions.md D-29).
                                                      // 물리적 삭제(prisma...delete)는 어떤 경우에도 하지 않는다.
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  @@index([dayOfWeek, isActive])
}

model BookingDay {
  id          String   @id @default(cuid())
  date        DateTime // 자정 00:00 Pacific/Auckland 기준으로 정규화해 저장
  dayOfWeek   Int      // 서버 계산, 입력 불가
  label       String?
  startTime   String   // "HH:mm", Pacific/Auckland 벽시계 표시값(날짜 계산에 관여하지 않음)
  endTime     String   // "HH:mm", startTime보다 늦어야 함
  location    String
  dutyPerson  String
  totalSlots  Int
  annualSlots Int      @default(0)
  casualSlots Int      @default(0)
  slotMode    SlotMode
  isOpen      Boolean  @default(true)
  clubDayPatternId String?  // ClubDayPattern.id를 가리키는 "약한 참조" — 의도적으로 Prisma @relation을
                             // 걸지 않는다(FK 제약 없음, decisions.md D-28). null이 아니면 클럽데이(크론
                             // 자동 생성), null이면 관리자가 수동 생성한 일반 예약일. 별도 isClubDay 컬럼 없음.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  bookings    Booking[]

  // date에 unique 제약 없음 (다중 세션 허용, 확정사항)
  // clubDayPatternId + date 조합에도 DB unique 제약을 두지 않는다 — 중복 생성 방지는
  // ClubDayGenerationService의 트랜잭션 내 조회로 처리한다(decisions.md D-28, 서비스 레이어 체크).
  @@index([date])
  @@index([clubDayPatternId])
}

model Booking {
  id                    String   @id @default(cuid())
  bookingDayId          String
  bookingDay            BookingDay @relation(fields: [bookingDayId], references: [id])
  name                  String
  normalizedName        String
  phoneHash             String   // HMAC-SHA256(normalizedPhone) — 조회/중복확인/취소검증용, 평문 아님
  phoneEncrypted        String   // AES-256-GCM(normalizedPhone) — 관리자 열람 시에만 복호화
  memberType            MemberType
  matchedAnnualMemberId String?
  matchedAnnualMember   AnnualMember? @relation("MatchedAnnualMember", fields: [matchedAnnualMemberId], references: [id])
  status                BookingStatus
  source                BookingSource
  paymentConfirmed      Boolean  @default(false)  // decisions.md D-31, requirements.md 26번
  paymentConfirmedAt    DateTime?                  // 확인 취소 시 다시 null로 되돌아감
  paymentProof          PaymentProof?              // 1:1, 아래 모델 참고(decisions.md D-31 — 이미지는 분리 저장)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  cancelledAt           DateTime?

  // 중복/재예약 판정(18번)은 status에 따라 조건부이므로 DB unique 제약으로는 표현하지 않고
  // 서비스 로직(트랜잭션 내 조회)으로 강제한다. 아래 인덱스는 조회 성능용.
  @@index([bookingDayId, normalizedName, phoneHash])
  @@index([phoneHash])
  @@index([bookingDayId, status])
}

// 결제 증빙 이미지(decisions.md D-31·D-32). Booking과 분리한 이유: Booking은 이 시스템에서 가장
// 자주/대량으로 조회되는 모델이라, 수백 KB 단위의 base64 이미지를 직접 컬럼으로 두면 일반 조회
// 성능에 함정이 된다. 이미지는 관리자가 명시적으로 조회할 때만 이 모델을 통해 가져온다.
model PaymentProof {
  id         String            @id @default(cuid())
  bookingId  String            @unique
  booking    Booking           @relation(fields: [bookingId], references: [id])
  imageData  String            // base64 인코딩된 이미지 바이트(Turso/SQLite에 텍스트로 저장, D-32)
  mimeType   String            // "image/jpeg" | "image/png" | "image/webp"
  uploadedBy ProofUploadSource // SELF(회원 셀프 업로드) | ADMIN(관리자 대리 업로드)
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt // 재업로드(교체) 시 갱신
}

// 참여자 영구 식별 코드(오프라인 매칭 프로그램 연동용, decisions.md D-33, requirements.md 27번).
// AnnualMember/Booking 어느 쪽에도 FK로 종속되지 않는다 — 의도적으로 독립 모델이다(D-33 사유 참고).
// 신원 키(normalizedName+phoneHash)는 Booking의 중복 예약 판정(18번)과 동일한 정의를 재사용한다.
model ParticipantCode {
  id                 String   @id @default(cuid())
  name               String   // 표시용, 생성 시점의 정규화된 이름으로 고정(신원 키의 일부라 이후 갱신되지 않음)
  normalizedName     String
  phoneHash          String   // HMAC-SHA256(normalizedPhone) — Booking/AnnualMember와 동일한 조회용 해시
  phoneEncrypted     String   // AES-256-GCM(normalizedPhone) — CSV 내보내기(27.5번) 시에만 복호화
  code               String   @unique // 12자 랜덤 문자열(crypto.randomBytes(9).toString("base64url")). QR에는 이 값만 인코딩
  excludedFromExport Boolean  @default(false) // true면 CSV 내보내기에서 제외(opt-out, decisions.md D-34 개정 1).
                                                // 관리자가 다시 false로 되돌리기 전까지 영구 유지
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([normalizedName, phoneHash])
}

// CSV 내보내기 이력(decisions.md D-34 개정 2, requirements.md 27.5.3번). "누가" 받았는지는 기록하지
// 않는다 — 관리자가 공유 비밀번호 하나로 로그인하는 단일 계정 체제(architecture.md 5장)라 의미가 없다.
model ParticipantCodeExportLog {
  id            String   @id @default(cuid())
  exportedAt    DateTime @default(now())
  exportedCount Int      // 그 시점에 실제로 CSV에 담긴 행 수(excludedFromExport=false 필터 반영 후)
}
```

비고
- `date`, `dayOfWeek`는 Pacific/Auckland 타임존 기준으로 계산해 저장한다(6번 참고). SQLite/Prisma는 DateTime을 UTC로 저장하므로, 애플리케이션 계층(`lib/timezone.ts`)에서 "그 날짜의 Pacific/Auckland 자정"을 UTC로 환산해 저장하고, 표시할 때도 동일 유틸로 역변환한다.
- `Booking`에 조건부 유니크 제약을 걸지 않은 이유: "WAITING/CONFIRMED면 거부, CANCELLED만 있으면 재예약 허용(source 무관, D-08)"이라는 규칙은 상태값에 조건적으로 걸리는 로직이라 Prisma/SQLite의 정적 unique 제약으로 표현할 수 없다. 대신 `createBooking` 트랜잭션 내부에서 조회 후 판정한다(20번, 아래 5장 참고).
- `phoneHash`/`phoneEncrypted`로 분리한 이유는 decisions.md D-10 참고. 요지: `phoneHash`는 결정론적(같은 입력→같은 출력)이라 WHERE 절 equality 조회·unique 제약에 그대로 쓸 수 있지만, 복호화는 불가능하다. `phoneEncrypted`는 반대로 복호화 가능하지만 매번 다른 ciphertext가 나올 수 있어(IV) 조회에는 쓰지 않는다. 즉 "조회는 해시로, 열람은 암호문 복호화로" 역할을 분리한다.

---

## 4. API 라우트 목록

### 사용자용 (공개)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/booking-days` | 공개된(`isOpen=true`) 예약일 목록 조회 |
| GET | `/api/booking-days/[id]` | 예약일 상세 + 예약자 이름/상태 목록(전화번호 제외) |
| POST | `/api/bookings` | 예약 신청 (name, phone, bookingDayId) → `createBooking`. 응답에 `participantCode`(신규, requirements.md 27번) 포함 |
| POST | `/api/bookings/lookup` | 전화번호로 본인 예약 목록 조회 → `lookupBookingsByPhone`. 각 예약 항목에 `participantCode`(신규) 포함 |
| POST | `/api/bookings/[id]/cancel` | 예약 취소 (phone) → `cancelBooking` |
| POST | `/api/bookings/[id]/payment-proof` | 결제 증빙 셀프 업로드 (multipart/form-data: file, phone) → `uploadPaymentProof(..., "SELF", phone)` (신규, requirements.md 26.3) |

### 관리자용 (`middleware.ts`로 보호, `/api/admin/login` 제외)

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/admin/login` | 비밀번호 검증, 세션 쿠키 발급 |
| POST | `/api/admin/logout` | 세션 쿠키 무효화 |
| GET | `/api/admin/booking-days` | 예약일 전체 목록(비공개 포함) |
| POST | `/api/admin/booking-days` | 예약일 생성 → 생성 직후 월멤버 자동배정 |
| GET | `/api/admin/booking-days/[id]` | 예약일 상세(전체 정보) |
| PATCH | `/api/admin/booking-days/[id]` | 슬롯/장소/담당자/공개여부 등 수정 |
| DELETE | `/api/admin/booking-days/[id]` | 예약일 삭제 |
| GET | `/api/admin/booking-days/[id]/bookings` | 예약자 목록(이름/전화번호/상태/유형/source 전체) |
| POST | `/api/admin/booking-days/[id]/apply-monthly-members` | 해당 예약일에 월멤버 자동배정 재실행 |
| POST | `/api/admin/bookings` | 관리자 수동 예약 추가 (source=ADMIN) |
| PATCH | `/api/admin/bookings/[id]` | 예약 상태 변경(대기→확정 등) |
| POST | `/api/admin/bookings/[id]/cancel` | 관리자에 의한 예약 취소 처리 |
| GET | `/api/admin/bookings/[id]/payment-proof` | 결제 증빙 이미지 조회(data URL) → `getPaymentProof` (신규, requirements.md 26번) |
| POST | `/api/admin/bookings/[id]/payment-proof` | 결제 증빙 대리 업로드(multipart/form-data: file) → `uploadPaymentProof(..., "ADMIN")` (신규) |
| PATCH | `/api/admin/bookings/[id]/payment-confirmation` | 결제 확인/확인취소 (body: `{ confirmed: boolean }`) → `setPaymentConfirmation` (신규) |
| GET | `/api/admin/annual-members` | 연 멤버 목록 |
| POST | `/api/admin/annual-members` | 연 멤버 등록 |
| PATCH | `/api/admin/annual-members/[id]` | 연 멤버 수정/비활성화 |
| DELETE | `/api/admin/annual-members/[id]` | 연 멤버 "삭제" (실제로는 `isActive=false` 소프트 삭제, 하드 삭제 아님) |
| GET | `/api/admin/monthly-members` | 월 멤버 목록(연/월 필터) |
| POST | `/api/admin/monthly-members` | 월 멤버 등록(`dayOfWeeks` 배열로 여러 요일 한 번에 등록, decisions.md D-25) |
| PATCH | `/api/admin/monthly-members/[id]` | 월 멤버 수정(연/월/요일/메모, D-21) 및 활성/비활성 토글 |
| DELETE | `/api/admin/monthly-members/[id]` | 월 멤버 완전 삭제(하드 삭제, decisions.md D-26) |
| GET | `/api/admin/club-day-patterns` | 클럽데이 패턴 목록(삭제되지 않은 것만, decisions.md D-29) |
| POST | `/api/admin/club-day-patterns` | 클럽데이 패턴 등록 |
| PATCH | `/api/admin/club-day-patterns/[id]` | 패턴 수정 및 활성/비활성 토글(`isActive`) |
| DELETE | `/api/admin/club-day-patterns/[id]` | 패턴 소프트 삭제(`deletedAt` 기록, 물리적 삭제 아님, decisions.md D-29) |
| GET | `/api/admin/participant-codes` | 참여자 코드 목록(제외 설정 포함 전체) + 최근 내보내기 이력 → `listParticipantCodesForAdmin`/`countParticipantCodes`/`listParticipantCodeExportLogs` (신규, requirements.md 27.5번). 관리자 화면(`/admin/participant-codes`)은 Server Component가 이 서비스 함수들을 직접 호출하며(다른 관리자 페이지와 동일 패턴, 예: `annual-members/page.tsx`), 이 라우트는 REST 표면의 일관성을 위해 함께 제공한다 |
| PATCH | `/api/admin/participant-codes/[id]` | 내보내기 제외 토글 전용(body: `{ excludedFromExport: boolean }`) → `setParticipantCodeExclusion` (신규, requirements.md 27.5.2번, decisions.md D-34 개정 1) |
| DELETE | `/api/admin/participant-codes/[id]` | 참여자 코드 완전 삭제(하드 삭제, 되돌릴 수 없음) → `deleteParticipantCode` (신규, requirements.md 27.5.4번) |
| GET | `/api/admin/participant-codes/export` | 참여자 코드 CSV 다운로드(코드/이름/전화번호, `excludedFromExport=false`만) → `listParticipantCodesForExport` 호출 후 `recordParticipantCodeExport`로 이력 기록 (신규, requirements.md 27.5번, decisions.md D-34) |
| GET | `/api/admin/dashboard` | 대시보드 요약 데이터 |

예약자 목록/연 멤버 목록을 반환하는 GET 라우트는 DB의 `phoneEncrypted`를 서버(route handler)에서 복호화해 평문 전화번호로 응답에 담는다. 클라이언트로는 항상 복호화된 평문이 내려가며, `phoneHash`/`phoneEncrypted` 원값은 API 응답에 노출하지 않는다.

**결제 증빙 관련 신규 라우트 비고**
- `listBookingsForAdmin`(`GET /api/admin/booking-days/[id]/bookings`)과 `lookupBookingsByPhone`(`POST /api/bookings/lookup`)의 응답에는 `paymentConfirmationRequired`(계산값)·`paymentConfirmed`·`hasPaymentProof`(boolean, `PaymentProof` 존재 여부)만 포함하고, `PaymentProof.imageData`(base64 본문)는 절대 포함하지 않는다. 이미지 자체는 `GET /api/admin/bookings/[id]/payment-proof`를 관리자가 명시적으로 호출했을 때만 내려간다(decisions.md D-31, 목록 응답 비대화 방지).
- 업로드 라우트(`POST /api/bookings/[id]/payment-proof`, `POST /api/admin/bookings/[id]/payment-proof`)는 `multipart/form-data`를 Next.js Route Handler의 내장 `Request.formData()`(Web API)로 파싱한다. 별도 파서 라이브러리(`multer`, `formidable` 등)를 추가하지 않는다(decisions.md D-32, 최소 의존성 원칙). 서버는 파일 크기 2MB 상한과 MIME 타입(jpeg/png/webp)을 검증한다.
- 클라이언트 업로드 전 압축(`lib/imageCompression.ts`)도 브라우저 네이티브 `Image`/`HTMLCanvasElement`/`canvas.toBlob` API만 사용하며 새 npm 의존성이 없다. 즉 이번 기능은 `package.json`에 어떤 패키지도 추가하지 않는다(`@vercel/blob` 등 오브젝트 스토리지 SDK 불필요, decisions.md D-32).

**참여자 코드 관련 신규 라우트 비고 (requirements.md 27번, decisions.md D-33~D-35)**
- `GET /api/admin/participant-codes/export`는 JSON이 아니라 `Content-Type: text/csv; charset=utf-8` 응답을 직접 만든다(`withApiHandler`의 `{ data }`/`{ error }` JSON 포맷을 따르지 않는 이 프로젝트의 첫 예외 라우트 — 파일 다운로드이므로 `Content-Disposition: attachment; filename="participant-codes-{Pacific/Auckland 기준 YYYYMMDD}.csv"` 헤더를 함께 내려보낸다). 응답 본문 맨 앞에 UTF-8 BOM(`﻿`)을 붙여 한글이 포함된 CSV를 Excel에서 열었을 때 깨지지 않도록 한다.
- CSV 값 이스케이프: 쉼표/따옴표/개행이 포함된 값은 큰따옴표로 감싸고 내부 큰따옴표는 두 번 반복해 이스케이프한다(표준 CSV 규칙). 이름/전화번호에는 실질적으로 쉼표가 들어갈 일이 거의 없지만 방어적으로 항상 이스케이프를 적용한다.
- `POST /api/bookings`, `POST /api/bookings/lookup` 응답에 추가되는 `participantCode`는 항상 문자열이다(백필 스크립트로 기존 데이터도 전부 커버되므로 이 기능 배포 이후에는 `null`이 될 일이 없다 — 단, 배포 직후 백필 스크립트 실행 전까지의 과도기에는 과거 예약 조회 시 `participantCode`가 없을 수 있으니, 클라이언트는 방어적으로 값이 없으면 QR 버튼을 숨긴다).
- `GET /api/admin/participant-codes/export` 핸들러는 (1) `listParticipantCodesForExport()` 호출 → (2) CSV 문자열 생성 → (3) `recordParticipantCodeExport(rows.length)` 호출(같은 요청 처리 안에서, CSV 응답을 만든 직후) → (4) CSV 응답 반환 순서로 처리한다. 이력 기록은 실제로 CSV가 생성되는 이 라우트에서만 일어나며, 화면 조회(`GET /api/admin/participant-codes`, `listParticipantCodesForAdmin`)에서는 호출하지 않는다(decisions.md D-34 개정 2 — "언제 실제로 내보냈는지"만 기록).
- `PATCH /api/admin/participant-codes/[id]`는 이 프로젝트의 다른 PATCH 라우트(예: `PATCH /api/admin/club-day-patterns/[id]`가 `isActive` 토글을 처리하는 것)와 동일하게, 단일 필드(`excludedFromExport`)만 받아 갱신한다. 다른 필드(`code`, `name` 등)는 이 라우트로 수정할 수 없다 — `ParticipantCode`는 예약 생성 시에만 시스템이 채우는 파생 데이터이므로(decisions.md D-34) 관리자가 임의로 값을 바꿀 수 있는 일반 수정 API를 두지 않는다.
- `DELETE /api/admin/participant-codes/[id]`(신규, requirements.md 27.5.4번)는 같은 `[id]` 라우트 파일에 `PATCH`와 함께 정의된다(같은 리소스에 대한 두 메서드). `deleteParticipantCode`가 대상이 없으면 `NotFoundError`를 던지고, 있으면 즉시 하드 삭제한다 — 소프트 삭제(`deletedAt`)가 아니다. 지인 대리 예약(본인 번호로 지인 이름 등록)으로 잘못 만들어진 신원을 정리하는 용도이며, 삭제된 신원이 다시 예약하면 `ensureParticipantCode`가 새 코드를 발급할 뿐 이전 코드는 복구되지 않는다. 여러 행을 하나로 합치는 "병합"은 다루지 않는다(YAGNI, requirements.md 27.5.4번).

### 크론용 (`/api/admin/*` 미들웨어 보호 대상이 아님, 라우트 자체에서 `CRON_SECRET` 검증)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/cron/club-days` | Vercel Cron이 매일 1회(뉴질랜드 기준 오후 10:30, 22:30경) 호출. `assertCronSecret`으로 `Authorization: Bearer {CRON_SECRET}` 헤더 검증 후 `generateUpcomingClubDays()` 실행(decisions.md D-27 개정) |

---

## 5. 관리자 인증 방식 상세

- 로그인(`POST /api/admin/login`): 요청 body의 password를 환경변수 `ADMIN_PASSWORD`와 비교한다. 타이밍 공격 방지를 위해 단순 `===` 대신 길이를 맞춘 뒤 `crypto.timingSafeEqual`로 비교한다. (해시 저장 방식을 검토했으나, 관리자 1인 체제 + MVP 규모에서는 설정 편의를 우선해 평문 환경변수 유지로 최종 결정. decisions.md D-11/D-13 참고)
- 세션 payload: `{ role: "admin", iat, exp }` (exp = iat + 24h, 요구사항 21번 만료 예시 반영).
- 서명: `ADMIN_SESSION_SECRET`(별도 환경변수, `ADMIN_PASSWORD`와 분리)를 키로 HMAC-SHA256 서명. 쿠키 값 형식은 `base64url(payload) + "." + base64url(signature)`.
- 쿠키 속성: `httpOnly: true`, `secure: true`(프로덕션), `sameSite: "lax"`, `path: "/"`, `maxAge: 60*60*24`.
- DB 세션 테이블은 두지 않는다(요구사항 확정사항). 로그아웃은 쿠키를 즉시 만료시키는 방식으로 처리(서버 측 블랙리스트 없음 — MVP 범위에서는 24시간 자연 만료로 충분하다고 판단).
- 검증 로직(`lib/auth/session.ts`)은 Edge Runtime에서도 동작해야 하므로 Node의 `crypto` 대신 Web Crypto API(`crypto.subtle`)로 구현해 `middleware.ts`와 route handler 양쪽에서 공유한다.
- `middleware.ts`: `/admin/:path*`(단, `/admin/login` 제외)와 `/api/admin/:path*`(단, `/api/admin/login` 제외)에 매칭되는 요청에서 쿠키를 검증한다. 실패 시 페이지 요청은 `/admin/login`으로 리다이렉트, API 요청은 `401 Unauthorized` JSON 응답을 반환한다.
- Route handler 내부에서도 서비스 호출 전 세션을 재검증한다(미들웨어 우회 가능성에 대한 방어적 이중 체크, MVP 수준에서는 선택적이지만 권장).

### 5-1. 크론 인증 방식 (`/api/cron/club-days`, decisions.md D-27)

- `/api/cron/club-days`는 `middleware.ts`의 매처(`/admin/:path*`, `/api/admin/:path*`)에 포함되지 않으므로 관리자 세션 검증을 거치지 않는다. 대신 이 라우트 핸들러 내부에서 직접 인증을 검증한다.
- Vercel은 크론이 등록된 경로를 호출할 때, 프로젝트에 설정된 `CRON_SECRET` 환경변수 값을 `Authorization: Bearer {CRON_SECRET}` 헤더로 자동으로 실어 보낸다(Vercel 공식 동작).
- `lib/auth/cronAuth.ts`의 `assertCronSecret(req: NextRequest)`가 요청의 `authorization` 헤더를 `` `Bearer ${process.env.CRON_SECRET}` ``와 비교한다. `CRON_SECRET` 환경변수가 설정되어 있지 않으면 즉시 에러(설정 누락을 조용히 통과시키지 않음), 헤더가 없거나 값이 다르면 `AdminAuthError`(401)를 던진다. 새 에러 클래스를 추가하지 않고 기존 `AdminAuthError`를 재사용한다(이 프로젝트의 "필요한 만큼만 에러 클래스를 둔다" 원칙, 8장 참고).
- 이 라우트는 관리자 화면에서 호출되지 않으므로(오직 Vercel Cron만 호출), `verifySessionFromRequest`(관리자 세션 쿠키 검증)는 사용하지 않는다.

---

## 6. 개인정보 암호화 (전화번호)

배경: DB가 Turso(외부 관리형 서비스)에 있으므로, 전화번호를 평문으로 저장하지 않는다(확정, decisions.md D-10). 이름은 공개 페이지에 그대로 노출되는 정보(D-04)라 암호화 대상이 아니다.

**`lib/security/phoneCrypto.ts`**
- `hashPhone(normalizedPhone: string): string` — `PII_SECRET_KEY`에서 HKDF로 파생한 HMAC 키로 `HMAC-SHA256(normalizedPhone)`을 계산해 hex/base64 문자열로 반환. 같은 입력은 항상 같은 출력(결정론적) → `AnnualMember`/`Booking`의 `phoneHash` 컬럼, 모든 equality 조회(중복확인/멤버판정/취소검증/전화번호 조회)에 사용.
- `encryptPhone(normalizedPhone: string): string` — `PII_SECRET_KEY`에서 HKDF로 파생한 AES 키로 AES-256-GCM 암호화(랜덤 IV + authTag 포함해 하나의 문자열로 인코딩). `phoneEncrypted` 컬럼에 저장. 매번 다른 ciphertext가 나오므로 조회에는 쓸 수 없음.
- `decryptPhone(phoneEncrypted: string): string` — 위 역연산. 관리자 화면용 GET 라우트에서만 호출한다(4장 참고).
- 두 함수 모두 Node.js 런타임 전제(Node `crypto` 모듈 사용). 이 유틸은 middleware/edge에서 호출되지 않으므로 edge 호환성 문제가 없다(세션 검증과는 별개 유틸).

**키 관리**
- 마스터 키는 환경변수 `PII_SECRET_KEY`(32바이트 이상, base64) 하나만 두고, HKDF-SHA256으로 `hashPhone`용 서브키와 `encryptPhone`용 서브키를 용도별로 분리 파생한다(같은 키를 두 용도로 재사용하지 않기 위함).
- `PII_SECRET_KEY`가 유출되면 즉시 교체(rotate)하고, 기존 `phoneHash`/`phoneEncrypted` 데이터를 새 키로 재계산(재암호화)하는 일회성 마이그레이션 스크립트가 필요하다. MVP 범위에서는 스크립트를 미리 만들어두지 않지만, 필요 시점에 추가할 수 있도록 이 유틸에 키 버전 관리를 넣지 않는 대신(과설계 방지) 절차만 문서로 남겨둔다.

**연 멤버/예약 등록 흐름**
- `createAnnualMember`, `createBooking` 등 쓰기 경로는 입력 phone을 정규화 → `hashPhone` + `encryptPhone` 계산 → 두 값만 저장한다. 평문 phone/normalizedPhone은 어떤 컬럼에도 남기지 않는다.
- 관리자용 GET 라우트(예약자 목록, 연 멤버 목록)에서만 `decryptPhone`을 호출해 응답에 평문을 담는다.

---

## 7. 트랜잭션 처리 원칙

`requirements.md` 20번 항목과 서비스 함수를 매핑한다. 모두 `prisma.$transaction(async (tx) => { ... })` 형태의 interactive transaction을 사용한다. SQLite는 단일 writer이므로 트랜잭션 내부 로직은 최대한 짧게 유지한다(외부 API 호출, 긴 연산 금지).

| 요구사항 20번 항목 | 담당 서비스 함수 | 트랜잭션 범위 |
|---|---|---|
| 예약 생성 | `BookingService.createBooking` | 기존 예약 조회(중복/재예약 판정) + memberType 판정에 필요한 연멤버 조회 + slot 카운트 조회 + insert + `ParticipantCodeService.ensureParticipantCode` 호출까지 한 트랜잭션으로 묶어 동시 요청 시 슬롯 초과를 방지하고, 예약과 참여자 코드 발급이 분리되어 한쪽만 성공하는 상태를 막는다(requirements.md 27번, decisions.md D-33) |
| 예약 취소 | `BookingService.cancelBooking` | 상태 조회/검증 + status 업데이트 + (CONFIRMED였다면) `promoteWaitingBookings` 호출까지 하나의 트랜잭션 |
| 관리자 승인 | `BookingService.adminChangeBookingStatus` | 슬롯 여유 재확인 + status 업데이트 |
| 슬롯 변경 | `BookingDayService.updateBookingDay` | BookingDay 업데이트 + (증가 시) `promoteWaitingBookings` 호출까지 하나의 트랜잭션. 감소 시에는 업데이트만 수행(강제 하향 없음) |
| 월 멤버 자동 배정 | `MonthlyMemberService.applyMonthlyMembersToBookingDay` | 대상 월 멤버 조회 + 중복 예약 확인 + 예약 insert(들) + `ParticipantCodeService.ensureParticipantCodesBatch` 호출까지 BookingDay 단위로 하나의 트랜잭션 |
| 대기자 자동 승격 | `BookingService.promoteWaitingBookings` | 남은 슬롯 계산 + 대상 대기자 목록(FIFO 정렬) 조회 + 순차 status 업데이트. 단독 호출 시에도 자체 트랜잭션으로 감싸고, 위 취소/슬롯변경 흐름에서 호출될 때는 상위 트랜잭션에 참여(같은 `tx` 인스턴스 전달) |
| 클럽데이 생성(신규) | `ClubDayGenerationService.generateUpcomingClubDays` | 패턴별로 개별 트랜잭션 — 중복 생성 확인(`clubDayPatternId`+`date`) + `BookingDay` insert + (조건부) `applyMonthlyMembersToBookingDay`까지 패턴 단위로 하나의 트랜잭션. 한 패턴의 실패가 다른 패턴 처리에 영향을 주지 않는다 |

공통 원칙
- 모든 서비스 함수는 Prisma 트랜잭션 클라이언트(`tx`)를 인자로 받을 수 있도록 설계해, 상위 트랜잭션에 참여(nested call)할 수 있게 한다.
- "슬롯 여유 확인 → insert/update" 사이에 다른 요청이 끼어들지 않도록, 카운트 조회와 쓰기는 반드시 같은 트랜잭션 안에서 수행한다(동시 예약 시 슬롯 초과 방지, 확정 사항).

---

## 8. 에러 핸들링 / 응답 형식 컨벤션

MVP 수준의 단순한 컨벤션.

- 공통 에러 클래스(`lib/errors.ts`): `AppError(code: string, message: string, httpStatus: number)`를 베이스로 하고, 필요한 하위 클래스만 최소한으로 둔다.
  - `ValidationError` (400) — 입력값 오류(예: 슬롯 합 불일치)
  - `AdminAuthError` (401) — 로그인 실패/세션 무효
  - `NotFoundError` (404) — 예약일/예약/멤버 없음
  - `ConflictError` (409) — 중복 예약, 슬롯 초과로 승인 불가, 전화번호 불일치로 취소 거부
- 응답 형식
  - 성공: `{ "data": ... }`
  - 실패: `{ "error": { "code": "CONFLICT", "message": "이미 예약이 존재합니다." } }`
- Route handler 공통 wrapper(`lib/http.ts`)를 두어 각 라우트는 `withApiHandler(async (req) => { ... })` 형태로 작성한다. wrapper가 `AppError`는 지정된 httpStatus/코드로, 그 외 예외는 500 + 일반 메시지로 변환하고 서버 로그를 남긴다.
- 클라이언트(React)는 이 형식을 기준으로 `error.code`에 따라 사용자 메시지를 분기 표시한다(예: `CONFLICT`이면 "이미 예약된 내역이 있습니다" 등).

---

## 9. 배포

호스팅/배포 관련 내용(Vercel/Turso 구성, 환경변수, 마이그레이션 워크플로우, 플랫폼 주의사항)은 `deployment.md`로 분리했다(확정, decisions.md D-12). 배포 대상은 이후 바뀔 수 있어, 코드/도메인 아키텍처를 다루는 이 문서와 독립적으로 관리한다.
