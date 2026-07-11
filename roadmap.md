# 배드민턴 예약 관리 시스템 — 개발 로드맵

기준 문서: `requirements.md` 22번(개발 우선순위), `기획서.md` 3장(MVP 범위 재확인)
목적: 기능을 Phase 단위로 묶고, Phase 간 선행 의존관계를 명확히 한다. 시간/일정 추정은 포함하지 않는다(팀 규모 미확정).

---

## Phase 0. 프로젝트 셋업

**포함 기능**
- Next.js(App Router) 프로젝트 초기화, Tailwind CSS/shadcn/ui 설치
- Prisma 설치, `schema.prisma` 초안 작성(`architecture.md` 3장 기준), Turso(libSQL) 연결(`@prisma/adapter-libsql`), 로컬 개발용 파일 SQLite도 병행 구성
- 환경변수 구성(`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `PII_SECRET_KEY`)
- 기본 디렉토리 구조(`lib/services`, `lib/db`, `components` 등) 생성
- Vercel 프로젝트 연결 및 환경변수 등록, Turso 데이터베이스 생성(`deployment.md` 기준)

**선행 의존성**
- 없음(최초 단계)

**완료 시 확인할 대표 시나리오**
- 로컬 파일 SQLite 기준으로 `npx prisma migrate dev` 실행 시 스키마가 오류 없이 생성된다.
- 개발 서버 기동 후 빈 페이지라도 정상 렌더링되며, Vercel에 배포한 프리뷰 환경에서도 Turso DB에 정상 연결된다.

---

## Phase 1. 관리자 인증 + 예약일 CRUD

**포함 기능**
- `AdminAuthService`: 로그인(`ADMIN_PASSWORD` 비교)/로그아웃/세션 검증, 서명된 HttpOnly 쿠키 발급
- `middleware.ts`: 관리자 라우트 보호
- `BookingDayService`: 예약일 생성/수정/삭제/조회, `dayOfWeek` 서버 자동계산, `slotMode`(SEPARATED/COMBINED)별 슬롯 합 검증, `isOpen` 토글
- 관리자 로그인 화면, 예약일 목록/생성/수정 화면

**선행 의존성**
- Phase 0 (Prisma 스키마, 프로젝트 구조)

**완료 시 확인할 대표 시나리오**
- 올바른 비밀번호로 로그인하면 세션 쿠키가 발급되고, 세션 없이 관리자 화면 접근 시 로그인 페이지로 리다이렉트된다.
- 분리 슬롯 모드에서 연 슬롯+캐주얼 슬롯 합이 전체 슬롯과 다르면 저장이 거부된다.

---

## Phase 2. 사용자 예약 신청 + 자동승인/대기 처리

**포함 기능**
- 정규화 유틸(`normalizeName`, `normalizePhone`), 전화번호 암호화 유틸(`hashPhone`, `encryptPhone`, `decryptPhone`)
- `AnnualMemberService.determineMemberType` (이 시점엔 연 멤버 관리 UI가 아직 없으므로, 테스트 데이터는 Prisma Studio/시드 스크립트로 직접 입력)
- `BookingService.createBooking`: 중복/재예약 판정(취소 이력만 있으면 USER/ADMIN 소스는 재예약 허용), 슬롯 정책(SEPARATED/COMBINED) 반영한 자동 CONFIRMED/WAITING 판별, 트랜잭션 처리
- 공개 예약일 목록/상세 화면, 예약 신청 폼, 공개 화면에서의 이름 노출(전화번호는 비공개)

**선행 의존성**
- Phase 1 (예약일 데이터 필요)
- Phase 0에서 정의된 `AnnualMember`, `Booking` 테이블 존재(관리 UI는 아직 없어도 무방)

**완료 시 확인할 대표 시나리오**
- 슬롯이 남은 예약일에 신청하면 `CONFIRMED`, 슬롯이 가득 찬 예약일에 신청하면 `WAITING`으로 생성되고 화면에서 구분 표시된다.
- 동일 예약일에 이미 `WAITING`/`CONFIRMED` 상태인 동일 이름+전화번호로 재신청하면 거부된다.

---

## Phase 3. 예약 취소 + 대기 승격

**포함 기능**
- `BookingService.lookupBookingsByPhone` (전화번호로 예약 목록 조회)
- `BookingService.cancelBooking` (bookingId + 전화번호 검증 후 취소, `cancelledAt` 기록)
- `BookingService.promoteWaitingBookings` (FIFO 자동 승격 — 신청 순서, 동시각이면 id 오름차순)
- `BookingDayService.updateBookingDay`의 슬롯 증가 시 자동 승격 연계
- 관리자 예약 운영 일부: 예약자 목록 조회, 상태 변경(대기→확정), 관리자 취소 처리, 수동 예약 추가(source=ADMIN)
- 사용자 취소 2단계 화면(조회 → bookingId 선택 → 취소)

**선행 의존성**
- Phase 2 (예약 생성 로직 및 데이터 필요)

**완료 시 확인할 대표 시나리오**
- `CONFIRMED` 예약을 취소하면 대기 1순위가 자동으로 `CONFIRMED`로 승격된다.
- 슬롯 20명 확정/대기 3명 상태에서 슬롯을 22명으로 늘리면 대기 2명이 신청 순서대로 자동 확정된다.
- 취소 후 같은 사용자가 같은 예약일에 재신청하면 새 예약 건으로 정상 생성된다.

---

## Phase 4. 연 멤버 / 월 멤버 관리 + 자동 배정

**포함 기능**
- `AnnualMemberService`: 연 멤버 등록/수정/비활성화(하드 삭제 없음), `normalizedName+normalizedPhone` 유니크 검증
- `MonthlyMemberService`: 월 멤버 등록/수정/비활성화(하드 삭제 없음), `annualMemberId+year+month+dayOfWeek` 유니크 검증
- `applyMonthlyMembersToBookingDay` / `applyMonthlyMembersToMonth`: 예약일 생성 시 자동 트리거, 예약일 상세 화면의 수동 실행 버튼, 월 멤버 관리 화면의 일괄 실행 버튼
- 자동 배정 결과(생성 건수/스킵 건수) 안내 UI
- 연 멤버/월 멤버 관리 화면

**선행 의존성**
- Phase 1 (BookingDay 생성 로직 필요)
- Phase 2 (`determineMemberType` 로직을 자동 배정에서도 재사용)
- Phase 3 (슬롯 부족 시 `WAITING` 처리 로직 필요 — 자동 배정도 동일 판별을 사용)

**완료 시 확인할 대표 시나리오**
- 월 멤버(김민수/2026년 7월/화요일)를 등록한 뒤 2026-07-07(화) 예약일을 생성하면 자동으로 예약이 추가된다(슬롯 여유 시 `CONFIRMED`).
- 연 멤버를 비활성화하면 이후 자동 배정 대상에서 제외되고, 예약 신청 시 판별도 `CASUAL`로 처리된다.
- 동일 예약일에 이미 확정/대기 중인 동일인이 있으면 자동 배정이 중복 생성하지 않는다. 반면 취소 이력만 있는 동일인은 재생성된다(소스 무관 재예약 정책).

---

## Phase 5. 관리자 대시보드

**포함 기능**
- `DashboardService`: 오늘(Pacific/Auckland 기준) 예약 현황, 날짜별 확정/대기/취소 인원, 슬롯 사용률, 대기 인원 발생 경고(decisions.md D-16 — D-14/D-15 이후 "슬롯 초과" 상태는 앱의 정상 동작으로 발생하지 않아 대체됨)
- 대시보드 화면(1차 릴리즈는 핵심 지표만, 상세 통계/차트는 Phase 6 이후로 미룸)

**선행 의존성**
- Phase 1~4 (전체 예약/멤버 데이터가 쌓여야 의미 있는 집계 가능)

**완료 시 확인할 대표 시나리오**
- 대시보드의 "오늘" 기준이 Pacific/Auckland 자정 경계로 정확히 계산된다(UTC나 서버 로컬 시간 기준이 아님).
- 슬롯이 가득 차 대기 인원이 있는 예약일에 시각적 경고가 표시된다.

---

## Phase 6. UI/UX 다듬기

**포함 기능**
- 반응형 레이아웃, 로딩/에러 상태 피드백, 인터랙션 개선(취소 확인 다이얼로그 등), shadcn 컴포넌트 스타일 통일, 접근성 개선

**선행 의존성**
- Phase 1~5의 기능적 완성(1~11번 요구사항이 모두 동작하는 상태)

**완료 시 확인할 대표 시나리오**
- 모바일 화면 폭에서 예약 신청부터 취소까지 전체 플로우가 끊김 없이 동작한다.
- 취소·승인 등 주요 액션에 로딩 상태와 성공/실패 피드백이 일관되게 표시된다.
