# 배드민턴 예약 관리 시스템 — 애플리케이션

프로젝트 전체 소개, 기능 목록, 영문 설명은 [저장소 루트 README](../README.md)를 참고하세요.
이 문서는 이 디렉토리(Next.js 앱) 자체를 실행/개발하는 방법만 다룹니다.

이 애플리케이션은 루트의 [`requirements.md`](../requirements.md) / [`architecture.md`](../architecture.md) /
[`decisions.md`](../decisions.md)에 정의된 스펙을 그대로 구현한 것입니다. 요구사항이 코드와 다르게 보이면
코드가 아니라 그 문서들이 맞습니다.

## 실행 방법

```bash
# 1. 의존성 설치 (postinstall에서 prisma generate 자동 실행)
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env를 열어 값을 채운다 (각 변수 설명은 .env.example 주석 참고)

# 3. 로컬 SQLite(dev.db)에 스키마 생성
npx prisma migrate dev

# 4. 개발 서버 실행
npm run dev
```

개발 서버가 뜨면:
- `http://localhost:3000/` — 공개 예약일 목록 (`isOpen=true`만 노출, 날짜 필터 있음)
- `http://localhost:3000/booking-days/[id]` — 예약일 상세 + 예약 신청 폼
- `http://localhost:3000/lookup` — 전화번호로 내 예약 조회/취소
- `http://localhost:3000/admin/login` — 관리자 로그인
- `http://localhost:3000/admin/dashboard` — 관리자 대시보드
- `http://localhost:3000/admin/booking-days` — 예약일 목록/생성
- `http://localhost:3000/admin/annual-members`, `/admin/monthly-members` — 연/월 멤버 관리
- `http://localhost:3000/admin/club-day-patterns` — 클럽데이 반복 패턴 관리

## 개발 명령어

```bash
npm run dev        # 개발 서버
npm run build       # 프로덕션 빌드
npm run start       # 빌드된 앱 실행
npm run lint         # ESLint
npm run typecheck   # tsc --noEmit
npm run db:migrate  # prisma migrate dev
npm run db:studio   # Prisma Studio (DB GUI로 로컬 데이터 확인/편집)
```

## 디렉토리 구조

전체 구조와 각 서비스 함수의 역할은 [`architecture.md`](../architecture.md) 1~2장을 참고하세요. 요약:

```
app/            # Next.js App Router (공개 페이지 + admin/ + api/)
components/     # ui/(공용 컴포넌트) · admin/ · public/
lib/            # services/(도메인 로직) · security/ · auth/ · timezone.ts 등
prisma/         # schema.prisma, migrations/
```

## 배포

Vercel + Turso 조합으로 배포합니다. 프로덕션 마이그레이션은 `prisma migrate dev`가 아니라
`prisma migrate diff` + `turso db shell` 수동 절차를 따라야 합니다 — 자세한 내용은
[`deployment.md`](../deployment.md)를 참고하세요.
