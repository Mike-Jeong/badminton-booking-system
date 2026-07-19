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
    booking-days/[id]/page.tsx        # 예약자 목록(전체 정보) + 상태변경 + 자동배정 버튼 + 출석 열/버튼
    booking-days/[id]/check-in/page.tsx # 예약일별 체크인 스캔 화면 + 실시간 확정 예약자 명단 (decisions.md D-27)
    annual-members/page.tsx
    monthly-members/page.tsx
  api/
    booking-days/route.ts             # GET (공개 목록)
    booking-days/[id]/route.ts        # GET (공개 상세)
    bookings/route.ts                 # POST (사용자 예약 신청)
    bookings/lookup/route.ts          # POST (전화번호로 조회)
    bookings/[id]/cancel/route.ts     # POST (사용자 취소)
    admin/login/route.ts              # POST
    admin/logout/route.ts             # POST
    admin/booking-days/route.ts       # GET, POST
    admin/booking-days/[id]/route.ts  # GET, PATCH, DELETE
    admin/booking-days/[id]/bookings/route.ts               # GET (예약자 목록, 전체정보)
    admin/booking-days/[id]/apply-monthly-members/route.ts  # POST
    admin/bookings/route.ts           # POST (관리자 수동 예약 추가, source=ADMIN)
    admin/bookings/[id]/route.ts      # PATCH (상태 변경/승인)
    admin/bookings/[id]/cancel/route.ts # POST (관리자 취소 처리)
    admin/bookings/[id]/check-in/route.ts  # POST (수동 입장), DELETE (초기화) — decisions.md D-27
    admin/bookings/[id]/check-out/route.ts # POST (수동 퇴장) — decisions.md D-27
    admin/booking-days/[id]/scan/route.ts  # POST { bookingId } — QR 스캔 처리, 입장/퇴장 자동 판단 — decisions.md D-27
    admin/annual-members/route.ts     # GET, POST
    admin/annual-members/[id]/route.ts # PATCH, DELETE
    admin/monthly-members/route.ts    # GET, POST
    admin/monthly-members/[id]/route.ts # PATCH, DELETE
    admin/monthly-members/apply/route.ts # POST (연/월[/요일] 일괄 자동배정)
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
  normalize.ts                # normalizeName, normalizePhone
  timezone.ts                  # Pacific/Auckland 관련 유틸(오늘 날짜, dayOfWeek 계산)
  checkInQr.ts                 # encodeBookingQrValue/decodeBookingQrValue — QR 값 "bkg:{bookingId}" 인코딩/디코딩 (decisions.md D-27)
  security/
    phoneCrypto.ts             # hashPhone(HMAC-SHA256), encryptPhone/decryptPhone(AES-256-GCM), PII_SECRET_KEY 기반
  auth/
    session.ts                # 쿠키 서명(sign)/검증(verify), payload 정의
  errors.ts                    # AppError 및 하위 에러 클래스, 응답 포맷터
  http.ts                      # route handler 공통 wrapper(try/catch → 응답 포맷)

components/
  ui/                          # shadcn/ui 컴포넌트 (button, input, table, dialog 등)
  admin/                       # 관리자 화면 전용 컴포넌트
  public/                      # 사용자 화면 전용 컴포넌트

middleware.ts                  # /admin/*, /api/admin/* 보호 (로그인 라우트 제외)

prisma/
  schema.prisma
  migrations/

.env                            # ADMIN_PASSWORD, ADMIN_SESSION_SECRET,
                                 # TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, PII_SECRET_KEY
```

배포는 Vercel(Hobby, 무료) + Turso(무료 티어)를 사용한다(확정, decisions.md D-09). Docker/자체 서버 배포는 사용하지 않으므로 `Dockerfile`/`docker-compose.yml`은 두지 않는다. 자세한 내용은 `deployment.md` 참고.

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
- `checkInBooking(bookingId)` / `checkOutBooking(bookingId)` / `resetCheckInStatus(bookingId)` — 관리자 수동 체크인 처리(decisions.md D-27). `status !== CONFIRMED`이거나 순서가 어긋나면(`checkedInAt` 없이 퇴장 시도 등) `ConflictError`. D-23의 종료된 예약일 차단을 받지 않는다.
- `scanBookingCheckIn(bookingId, bookingDayId)` — QR 스캔 처리 전용(decisions.md D-27). 예약의 `bookingDayId`가 스캔 화면의 `bookingDayId`와 다르면 `ConflictError`, 아니면 현재 상태에 따라 입장/퇴장을 자동 판단해 처리하고 `{ booking, action: "CHECKED_IN" | "CHECKED_OUT" }`을 반환한다.

### AnnualMemberService (`lib/services/annualMemberService.ts`)
- `determineMemberType(name, phone)`: 정규화 → `hashPhone` 변환 → 활성 연 멤버 중 `normalizedName + phoneHash` 일치 조회 → ANNUAL/CASUAL 판정 (createBooking, applyMonthlyMembersToBookingDay 양쪽에서 재사용). 복호화가 필요 없다.
- `createAnnualMember(input)` / `updateAnnualMember(id, input)` / `deactivateAnnualMember(id)` — 저장 시 `phoneHash`/`phoneEncrypted` 계산
- `listAnnualMembers(filter)`
- 하드 삭제 없음(확정, decisions.md D-07). 관리자 화면의 "삭제" 액션은 `deactivateAnnualMember`를 호출해 `isActive=false`로만 처리한다.

### MonthlyMemberService (`lib/services/monthlyMemberService.ts`)
- `createMonthlyMember(input)` / `createMonthlyMembersBulk(input)` / `updateMonthlyMember(id, input)` / `deleteMonthlyMember(id)`
- `listMonthlyMembers(filter)` — 연/월 단위 필터
- `applyMonthlyMembersToBookingDay(bookingDayId)`
- 비활성화(`isActive=false`)는 `updateMonthlyMember`로, 완전 삭제(하드 삭제)는 `deleteMonthlyMember`로 별도 제공한다(decisions.md D-26 — MonthlyMember는 Booking 등 다른 레코드가 FK로 참조하지 않아, AnnualMember와 달리 D-07의 "하드 삭제 없음" 원칙을 적용할 이유가 없다). 특정 멤버를 특정 요일 자동 배정에서 영구 제외하고 싶을 때는 비활성화로 처리한다(D-08).
- `createMonthlyMembersBulk`는 여러 요일을 한 번에 등록할 때 쓰며, 요일별로 `createMonthlyMember`를 호출해 일부 요일이 중복이어도 나머지는 정상 등록되는 부분 성공을 허용한다(decisions.md D-25).

### DashboardService (`lib/services/dashboardService.ts`)
- `getTodaySummary()` — Pacific/Auckland 기준 "오늘"
- `getSummaryByDateRange(from, to)` — 날짜별 확정/대기/취소 인원, 슬롯 사용률, 대기 인원 발생 경고
  플래그(`WAITING` 존재 여부). "슬롯 초과" 대신 이 지표를 쓰는 이유는 decisions.md D-16 참고 —
  D-14/D-15 이후 앱의 정상 동작으로는 슬롯 초과 상태 자체가 발생하지 않는다.

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
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  bookings    Booking[]

  // date에 unique 제약 없음 (다중 세션 허용, 확정사항)
  @@index([date])
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
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  cancelledAt           DateTime?
  checkedInAt           DateTime? // 회원 입장 처리 시각(decisions.md D-27)
  checkedOutAt          DateTime? // 회원 퇴장 처리 시각. checkedInAt 없이는 설정되지 않는다(decisions.md D-27)

  // 중복/재예약 판정(18번)은 status에 따라 조건부이므로 DB unique 제약으로는 표현하지 않고
  // 서비스 로직(트랜잭션 내 조회)으로 강제한다. 아래 인덱스는 조회 성능용.
  @@index([bookingDayId, normalizedName, phoneHash])
  @@index([phoneHash])
  @@index([bookingDayId, status])
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
| POST | `/api/bookings` | 예약 신청 (name, phone, bookingDayId) → `createBooking` |
| POST | `/api/bookings/lookup` | 전화번호로 본인 예약 목록 조회 → `lookupBookingsByPhone` |
| POST | `/api/bookings/[id]/cancel` | 예약 취소 (phone) → `cancelBooking` |

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
| GET | `/api/admin/annual-members` | 연 멤버 목록 |
| POST | `/api/admin/annual-members` | 연 멤버 등록 |
| PATCH | `/api/admin/annual-members/[id]` | 연 멤버 수정/비활성화 |
| DELETE | `/api/admin/annual-members/[id]` | 연 멤버 "삭제" (실제로는 `isActive=false` 소프트 삭제, 하드 삭제 아님) |
| GET | `/api/admin/monthly-members` | 월 멤버 목록(연/월 필터) |
| POST | `/api/admin/monthly-members` | 월 멤버 등록(`dayOfWeeks` 배열로 여러 요일 한 번에 등록, decisions.md D-25) |
| PATCH | `/api/admin/monthly-members/[id]` | 월 멤버 수정(연/월/요일/메모, D-21) 및 활성/비활성 토글 |
| DELETE | `/api/admin/monthly-members/[id]` | 월 멤버 완전 삭제(하드 삭제, decisions.md D-26) |
| GET | `/api/admin/dashboard` | 대시보드 요약 데이터 |

예약자 목록/연 멤버 목록을 반환하는 GET 라우트는 DB의 `phoneEncrypted`를 서버(route handler)에서 복호화해 평문 전화번호로 응답에 담는다. 클라이언트로는 항상 복호화된 평문이 내려가며, `phoneHash`/`phoneEncrypted` 원값은 API 응답에 노출하지 않는다.

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
| 예약 생성 | `BookingService.createBooking` | 기존 예약 조회(중복/재예약 판정) + memberType 판정에 필요한 연멤버 조회 + slot 카운트 조회 + insert 를 한 트랜잭션으로 묶어 동시 요청 시 슬롯 초과를 방지 |
| 예약 취소 | `BookingService.cancelBooking` | 상태 조회/검증 + status 업데이트 + (CONFIRMED였다면) `promoteWaitingBookings` 호출까지 하나의 트랜잭션 |
| 관리자 승인 | `BookingService.adminChangeBookingStatus` | 슬롯 여유 재확인 + status 업데이트 |
| 슬롯 변경 | `BookingDayService.updateBookingDay` | BookingDay 업데이트 + (증가 시) `promoteWaitingBookings` 호출까지 하나의 트랜잭션. 감소 시에는 업데이트만 수행(강제 하향 없음) |
| 월 멤버 자동 배정 | `MonthlyMemberService.applyMonthlyMembersToBookingDay` | 대상 월 멤버 조회 + 중복 예약 확인 + 예약 insert(들)를 BookingDay 단위로 하나의 트랜잭션 |
| 대기자 자동 승격 | `BookingService.promoteWaitingBookings` | 남은 슬롯 계산 + 대상 대기자 목록(FIFO 정렬) 조회 + 순차 status 업데이트. 단독 호출 시에도 자체 트랜잭션으로 감싸고, 위 취소/슬롯변경 흐름에서 호출될 때는 상위 트랜잭션에 참여(같은 `tx` 인스턴스 전달) |

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
