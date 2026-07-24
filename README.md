# 배드민턴 예약 관리 시스템 / Badminton Club Booking System

회원가입 없이 이름과 전화번호만으로 배드민턴 동호회 세션을 예약할 수 있는 웹 시스템입니다.
A registration-free booking system for a badminton club — members reserve sessions with just their name and phone number.

**[한국어](#한국어)** | **[English](#english)**

---

## 한국어

### 개요

- 회원가입 없이 이름 + 전화번호만으로 예약 신청/조회/취소가 가능합니다.
- 관리자는 환경변수 비밀번호 하나로 로그인해 예약일·연 멤버·월 멤버·예약 상태를 관리합니다.
- 연 멤버(정회원)/월 멤버(특정 요일 자동 배정)/캐주얼(비회원) 구분과, 매주 반복되는 "클럽데이"를 자동으로 생성·공개하는 기능까지 갖춘 실제 운영 중인 동호회용 시스템입니다.

### 주요 기능

**공개 화면 (한국어/영어 지원)**
- 예약 가능한 날짜 목록 조회 및 날짜 범위 필터
- 이름 + 전화번호로 예약 신청 — 슬롯이 있으면 즉시 확정, 없으면 대기 등록
- 전화번호로 내 예약 조회 후 개별 취소
- 종료된 예약일은 신청/취소만 막히고 조회는 계속 가능

**관리자 화면 (한국어 전용)**
- 예약일 생성/수정/삭제 (통합 슬롯 / 연·캐주얼 분리 슬롯 두 가지 정책 지원)
- 예약자 승인/취소/수동 추가, 대기자 자동 승격 (슬롯 증가·취소 시)
- 연 멤버(정회원) 관리 — 이름+전화번호로 자동 판별, 하드 삭제 없이 비활성화만 지원
- 월 멤버 관리 — 특정 연/월/요일에 자동 배정, 한 번에 여러 요일 등록, 비활성화와 완전 삭제 모두 지원
- **클럽데이 자동 생성** — 매주 반복되는 세션 패턴(요일/시간/장소/슬롯)을 한 번 등록해두면, Vercel Cron이 매일 자동으로 해당 요일의 예약일을 생성하고 즉시 공개 처리
- 관리자 대시보드 — 오늘 예약 현황, 슬롯 사용률, 대기 인원 경고

### 기술 스택

- **프레임워크**: Next.js 15 (App Router), React 19, TypeScript
- **스타일**: Tailwind CSS + 직접 작성한 shadcn 스타일 UI 컴포넌트
- **DB/ORM**: Turso(libSQL) + Prisma 6 (`@prisma/adapter-libsql`)
- **인증**: 환경변수 비밀번호 + 서명된 HttpOnly 쿠키 세션
- **개인정보 보호**: 전화번호는 평문 저장 없이 HMAC 해시(조회용) + AES-256-GCM 암호화(관리자 열람용)로만 저장
- **배포**: Vercel(Hobby) + Turso(무료 티어), Vercel Cron으로 클럽데이 자동 생성
- **다국어**: 공개 화면 한/영 지원(관리자 화면은 한글 전용)

### 문서 구조

이 저장소는 코드보다 설계 문서가 먼저이며, 각 문서의 역할이 명확히 분리되어 있습니다.

| 문서 | 역할 |
|---|---|
| [`requirements.md`](requirements.md) | 확정된 요구사항 (무엇을 만드는지) — 모든 설계/구현의 기준(SSOT) |
| [`decisions.md`](decisions.md) | 설계 결정 기록(ADR) — 왜 이렇게 만들었는지, 검토했던 대안과 사유 |
| [`architecture.md`](architecture.md) | 기술 아키텍처 — 요구사항을 어떤 구조(디렉토리/서비스 계층/스키마)로 구현했는지 |
| [`deployment.md`](deployment.md) | 배포/인프라 — 호스팅, 환경변수, 마이그레이션 운영 방법 |
| [`qa-checklist.md`](qa-checklist.md) | QA 체크리스트 — 기능별 완료 기준 |
| [`roadmap.md`](roadmap.md) | 개발 단계별 로드맵 |

실제 애플리케이션 코드는 [`badminton-app/`](badminton-app/) 디렉토리에 있습니다.

### 로컬에서 실행하기

```bash
cd badminton-app
npm install                      # postinstall에서 prisma generate 자동 실행
cp .env.example .env             # 아래 표를 참고해 값 채우기
npx prisma migrate dev           # 로컬 SQLite(dev.db)에 스키마 생성
npm run dev                      # http://localhost:3000
```

**환경변수 (`.env`)**

| 변수 | 설명 |
|---|---|
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호(평문) |
| `ADMIN_SESSION_SECRET` | 관리자 세션 쿠키 서명용 랜덤 키 |
| `TURSO_DATABASE_URL` | 로컬 개발은 `file:./dev.db`로 두면 됨 |
| `TURSO_AUTH_TOKEN` | 로컬 파일 DB에는 불필요 |
| `PII_SECRET_KEY` | 전화번호 해시/암호화용 마스터 키(`openssl rand -base64 32`) |
| `CRON_SECRET` | 클럽데이 자동 생성 크론 라우트 인증용 키(`openssl rand -hex 32`) |

프로덕션 배포(Vercel + Turso) 절차는 [`deployment.md`](deployment.md)를 참고하세요.

### 개발 명령어

`badminton-app/` 디렉토리 기준:

```bash
npm run dev        # 개발 서버
npm run build       # 프로덕션 빌드
npm run typecheck   # tsc --noEmit
npm run db:studio   # Prisma Studio (DB GUI)
npm run db:migrate  # prisma migrate dev
```

---

## English

### Overview

- Members can apply for, look up, and cancel bookings using only their name and phone number — no account creation required.
- The admin logs in with a single environment-variable password to manage booking days, annual/monthly members, and booking status.
- Built for a real, actively-run badminton club: it distinguishes annual members (paid regulars), monthly members (auto-assigned on specific weekdays), and casual walk-ins, and can automatically generate and publish recurring weekly "club day" sessions.

### Key Features

**Public pages (Korean/English)**
- Browse open booking days with a date-range filter
- Apply with just a name and phone number — auto-confirmed if slots are available, otherwise waitlisted
- Look up your own bookings by phone number and cancel individually
- Ended sessions block new applications/cancellations but remain visible for reference

**Admin pages (Korean only)**
- Create/edit/delete booking days, supporting both combined and split (annual/casual) slot pools
- Approve or cancel bookings, add bookings manually, automatic waitlist promotion on slot increase or cancellation
- Annual member management — matched by name+phone, deactivate-only (no hard delete, to preserve booking history)
- Monthly member management — auto-assigned on a given year/month/weekday, supports bulk multi-weekday registration, both deactivation and permanent deletion
- **Club-day auto-generation** — register a recurring weekly pattern (weekday, time, location, slots) once, and a daily Vercel Cron job creates and publishes matching booking days automatically
- Admin dashboard — today's summary, slot utilization, waitlist warnings

### Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS + hand-rolled shadcn-style UI components
- **DB/ORM**: Turso (libSQL) + Prisma 6 (`@prisma/adapter-libsql`)
- **Auth**: environment-variable password + signed HttpOnly cookie sessions
- **Privacy**: phone numbers are never stored in plaintext — an HMAC hash for lookups plus AES-256-GCM encryption for admin viewing
- **Deployment**: Vercel (Hobby) + Turso (free tier), with Vercel Cron driving club-day auto-generation
- **i18n**: public pages support Korean/English (the admin UI is Korean-only)

### Documentation Map

This repo treats design docs as the source of truth, with each document scoped to a distinct concern:

| Document | Role |
|---|---|
| [`requirements.md`](requirements.md) | Finalized requirements (what to build) — the single source of truth for all design/implementation |
| [`decisions.md`](decisions.md) | Architecture Decision Records — why things were built this way, alternatives considered |
| [`architecture.md`](architecture.md) | Technical architecture — how requirements map to directory structure, service layers, and schema |
| [`deployment.md`](deployment.md) | Deployment/infra — hosting, environment variables, migration workflow |
| [`qa-checklist.md`](qa-checklist.md) | QA checklist — acceptance criteria per feature |
| [`roadmap.md`](roadmap.md) | Phased development roadmap |

The actual application code lives in [`badminton-app/`](badminton-app/).

### Running Locally

```bash
cd badminton-app
npm install                      # runs `prisma generate` via postinstall
cp .env.example .env             # fill in values, see table below
npx prisma migrate dev           # creates schema in local SQLite (dev.db)
npm run dev                      # http://localhost:3000
```

**Environment variables (`.env`)**

| Variable | Description |
|---|---|
| `ADMIN_PASSWORD` | Admin login password (plaintext) |
| `ADMIN_SESSION_SECRET` | Random key for signing admin session cookies |
| `TURSO_DATABASE_URL` | Use `file:./dev.db` for local development |
| `TURSO_AUTH_TOKEN` | Not needed for a local file DB |
| `PII_SECRET_KEY` | Master key for phone hashing/encryption (`openssl rand -base64 32`) |
| `CRON_SECRET` | Auth key for the club-day auto-generation cron route (`openssl rand -hex 32`) |

See [`deployment.md`](deployment.md) for the production deployment process (Vercel + Turso).

### Development Commands

From the `badminton-app/` directory:

```bash
npm run dev        # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run db:studio   # Prisma Studio (DB GUI)
npm run db:migrate  # prisma migrate dev
```
