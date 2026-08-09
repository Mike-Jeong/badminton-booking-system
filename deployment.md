# 배드민턴 예약 관리 시스템 — 배포 문서

기준: `decisions.md` D-09(배포 방식), D-10(전화번호 암호화), D-11(관리자 비밀번호 해시), D-12(문서 분리 사유), D-27(클럽데이 자동 생성 크론)
이 문서는 호스팅/배포 인프라, 환경변수, 마이그레이션 운영, 플랫폼별 주의사항을 다룬다. 코드/도메인 아키텍처(디렉토리 구조, 서비스 계층, 스키마, API, 트랜잭션 등)는 `architecture.md`를 참고.

배포 대상은 프로젝트 상황에 따라 이후 바뀔 수 있어(D-12), `architecture.md`와 분리된 이 문서에서 독립적으로 관리한다. 배포 방식이 바뀌면 이 문서만 갱신하면 되고, 코드 아키텍처 문서는 건드릴 필요가 없다.

---

## 1. 현재 배포 구성: Vercel + Turso (확정, D-09)

무료 운영을 위해 Docker/자체 서버 대신 서버리스 조합을 사용한다.

**구성**
- 앱: Vercel(Hobby 플랜, 무료)에 Next.js 프로젝트를 그대로 배포. Route Handlers는 Vercel의 서버리스/엣지 함수로 실행된다.
- DB: Turso(무료 티어)에 libSQL 데이터베이스를 생성. Prisma는 `@prisma/adapter-libsql` + `@libsql/client`로 연결하며, `lib/db/prisma.ts`에서 `new PrismaLibSQL({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN })` 어댑터를 생성해 `new PrismaClient({ adapter })` 형태로 사용한다.

**환경변수 (Vercel 프로젝트 설정 > Environment Variables에 등록)**

| 변수 | 용도 |
|---|---|
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호(평문). 검토했던 해시 저장 방식은 decisions.md D-11/D-13 참고 — 관리자 1인 체제 + MVP 규모에서는 설정 편의를 우선해 평문 유지로 최종 결정 |
| `ADMIN_SESSION_SECRET` | 관리자 세션 쿠키 서명용 HMAC 키 (`ADMIN_PASSWORD`와 별도 값) |
| `TURSO_DATABASE_URL` | Turso DB 연결 URL |
| `TURSO_AUTH_TOKEN` | Turso 인증 토큰 |
| `PII_SECRET_KEY` | 전화번호 `phoneHash`/`phoneEncrypted` 계산용 마스터 키(D-10) |
| `CRON_SECRET` | 클럽데이 자동 생성 크론 라우트(`/api/cron/club-days`) 인증용 공유 비밀키(D-27). Vercel이 크론 호출 시 `Authorization: Bearer {CRON_SECRET}` 헤더로 자동 전송한다 — 별도로 헤더를 수동 설정할 필요 없음 |

`.env` 파일은 로컬 개발용으로만 사용하고, 실제 값은 Vercel 대시보드에 등록한다.

**최초 설정 절차**
1. 원하는 관리자 비밀번호를 `ADMIN_PASSWORD`에 그대로 등록한다.
2. Turso CLI로 데이터베이스를 생성하고 `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`을 발급받아 등록한다.
3. `PII_SECRET_KEY`를 안전하게 생성(예: `openssl rand -base64 32`)해 등록한다.
4. `CRON_SECRET`을 16자 이상의 임의 문자열로 생성(예: `openssl rand -hex 32`)해 등록한다. 개행/특수문자가 섞이지 않도록 주의한다(Authorization 헤더 값으로 그대로 쓰이기 때문).

---

## 1-1. 클럽데이 자동 생성 크론 설정 (D-27, 실행 시각·생성 대상일은 D-27 개정)

**`vercel.json`** (프로젝트 루트, `badminton-app/vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/club-days",
      "schedule": "30 9 * * *"
    }
  ]
}
```

- Vercel Cron의 `schedule`은 항상 UTC 기준이다. 목표 실행 시각은 뉴질랜드 기준 매일 오후 10:30(22:30)이다. `30 9 * * *`(매일 UTC 09:30)는 NZDT(서머타임, UTC+13) 기간에는 뉴질랜드 오후 10:30 정각과 일치하고(09:30 UTC + 13:00 = 같은 날 22:30), NZST(UTC+12) 기간에는 뉴질랜드 오후 9:30(21:30, 목표보다 1시간 이름)에 실행된다 — 서머타임 전환에 따라 로컬 실행 시각이 최대 1시간 어긋난다.
- 여기에 더해 Vercel **Hobby 플랜은 크론을 하루 1회만 등록할 수 있고, 지정한 시간(hour) 내에서 최대 ±59분까지 실행 시각이 흔들릴 수 있다**([Vercel 공식 문서](https://vercel.com/docs/cron-jobs/manage-cron-jobs)). 두 오차를 합치면 실제 실행 시각이 목표(뉴질랜드 오후 10:30) 기준 최대 약 2시간 가까이 흔들릴 수 있다.
- 이 오차는 감수하기로 확정했다(D-27). `generateUpcomingClubDays()`는 "정확히 22:30에 실행된다"고 가정하지 않고, 실행되는 순간의 Pacific/Auckland 기준 "오늘" 날짜를 다시 계산한 뒤 여기에 2일을 더한 날짜("모레")를 대상으로 생성 여부를 판단하므로, 실행 시각이 흔들려도(같은 날 안에서는) 대상 날짜 자체는 흔들리지 않는다.
- 생성 대상일이 실행일의 "오늘"이 아니라 "모레"(+2일)인 이유: 크론이 그날 늦게 실행되고 나서야 세션이 열리는 "오늘 생성" 방식은 회원이 예약할 수 있는 시간이 사실상 당일 이후로 줄어드는 문제가 있었다. 최소 이틀 전에는 세션이 열려 있도록 D-27을 개정했다(예: 월요일 22:30 실행 → 수요일 클럽데이 생성).
- Vercel Cron은 등록된 경로에 **GET** 요청을 보낸다. `/api/cron/club-days`는 `GET`으로 구현한다.
- Vercel이 이 요청에 `Authorization: Bearer {CRON_SECRET}` 헤더를 자동으로 실어 보내므로, 별도의 Vercel 설정 없이 라우트 핸들러에서 `CRON_SECRET` 환경변수와 비교하기만 하면 된다(architecture.md 5-1장 참고).
- Turso 쓰기 쿼터(월 1천만 행)에 미치는 영향은 무시할 수 있는 수준이다(하루 최대 활성 패턴 수만큼만 쓰기 발생, 동호회 규모에서는 하루 몇 건).

---

## 2. 마이그레이션 워크플로우 (주의)

- libSQL은 HTTP로 연결하는 구조라 `prisma migrate dev`/`deploy`를 원격 Turso DB에 직접 쓸 수 없다. 로컬에서 `prisma migrate diff`로 마이그레이션 SQL을 생성한 뒤, Turso CLI(`turso db shell` 등)로 원격 DB에 적용하는 방식을 사용한다.
- 로컬 개발 시에는 파일 기반 SQLite(`file:./dev.db`)로 개발하고, 배포 대상(Turso)에는 위 방식으로 스키마를 반영하는 것을 권장한다.
- `PII_SECRET_KEY`를 교체(rotate)하는 경우, 기존 `phoneHash`/`phoneEncrypted` 데이터를 새 키로 재계산하는 일회성 스크립트가 필요하다(사고 발생 시에만 작성, 평상시엔 불필요).

---

## 3. Vercel Hobby 플랜 관련 주의사항

- Hobby 플랜은 비상업적 개인/사이드 프로젝트 용도로 제한된다. 동호회 예약 시스템(회비 결제, 광고 없음)은 이 범위에 해당한다고 판단하지만, 향후 유료 기능(예: 결제)을 추가할 계획이 생기면 플랜 변경 필요 여부를 재검토해야 한다.
- 서버리스 함수는 요청마다 인스턴스가 새로 뜰 수 있어(콜드 스타트) 파일시스템에 상태를 저장할 수 없다. 이 아키텍처는 DB(Turso)만 상태를 가지므로 문제가 되는 지점은 없으나, 세션/캐시 등을 추가할 때도 항상 외부 저장소를 사용해야 한다는 점을 유의한다.

---

## 4. Turso 무료 티어 한도 (참고)

- 스토리지 5GB, 월 5억 행 읽기, 월 1천만 행 쓰기. 동호회 규모 예약 시스템에서는 사실상 여유롭다.
- 한도는 Turso 정책 변경에 따라 바뀔 수 있으니, 배포 전/정기적으로 [turso.tech/pricing](https://turso.tech/pricing)에서 재확인 권장.

### 4-1. 결제 증빙 이미지(base64-in-DB)로 인한 스토리지 사용량 모니터링 (decisions.md D-32)

결제 확인 기능(requirements.md 26번)의 증빙 이미지를 Turso DB에 base64로 저장하기로 했다(D-32 — 클럽데이가 주 7일 정기 운영되는 규모에서도 Vercel Blob의 더 작은 무료 스토리지 한도보다 Turso 5GB가 여유 있다고 판단). 다만 이 기능 하나가 유일하게 DB 용량을 꾸준히 늘리는 요인이므로, 다른 모델과 달리 사용량을 주기적으로 확인하는 것을 권장한다.
- Turso 대시보드에서 DB 스토리지 사용량을 몇 달에 한 번씩 확인한다.
- 5GB 중 상당 부분(예: 70~80%)에 도달하면 다음 중 하나를 검토한다: (1) 오래된 "확인 완료" 증빙 이미지를 수동으로 정리(Prisma Studio 등으로 `PaymentProof` 삭제, `Booking.paymentConfirmed`는 유지), (2) Turso 유료 플랜 전환(사용량 기반, 여전히 저렴함), (3) 이 시점에 Vercel Blob 등 별도 오브젝트 스토리지로 재이전(D-32 재검토).
- 이번 MVP 범위에는 자동 정리(retention) 기능을 포함하지 않는다(YAGNI) — 위 옵션은 한도에 근접했을 때 그때그때 대응하기 위한 참고 절차일 뿐, 지금 구현할 항목이 아니다.
- `uploadPaymentProof`가 클라이언트 사이드 압축(`lib/imageCompression.ts`)을 전제로 하므로, 이 압축 로직이 실제로 호출되고 있는지(예: 매우 큰 원본 파일이 그대로 올라오고 있지는 않은지)는 배포 후 실제 업로드 몇 건을 admin 화면에서 확인해보는 것을 권장한다.

---

## 5. 검토했던 대안 (참고, 현재는 채택 안 함)

배포 방식은 이후 바뀔 수 있으므로, 한 번 검토했던 대안을 기록해 둔다. 자세한 배경/사유는 `decisions.md` D-09 참고.

- **Oracle Cloud "Always Free" VM + Docker + SQLite 파일(볼륨 마운트)**: 완전 자체 호스팅. 비용은 $0이지만 VM 직접 관리(OS 패치, 보안), 가입 심사 지연/거절 리스크, 무료 한도 축소(2026년 6월부터 축소) 등의 운영 부담이 있어 채택하지 않았다. 향후 트래픽이 늘거나 데이터를 완전히 직접 관리하고 싶어지면 재고려할 수 있다.
- **GitHub Pages**: 정적 파일만 호스팅하므로 API/DB를 아예 실행할 수 없어 처음부터 제외.

---

## 6. 배포 방식이 바뀔 경우 체크할 것

이 문서가 코드 아키텍처와 분리되어 있는 이유(D-12)는 배포 대상이 바뀔 가능성 때문이다. 나중에 배포처를 바꾼다면:

- DB를 Turso가 아닌 다른 곳(자체 SQLite 파일, Postgres 등)으로 옮기는 경우 → `lib/db/prisma.ts`의 어댑터 구성과 `schema.prisma`의 `datasource` 설정만 바뀌면 되고, 서비스 계층(`lib/services/*`) 로직은 변경할 필요가 없다(Prisma 추상화 덕분).
- 앱 호스팅을 Vercel이 아닌 다른 곳(자체 서버 등)으로 옮기는 경우 → Route Handlers는 표준 Next.js 코드라 대부분의 Node.js 호스팅 환경에서 그대로 동작한다. 다만 서명 검증에 쓰는 Web Crypto API 기반 코드(`lib/auth/session.ts`)는 Node 런타임에서도 문제없이 동작하는지 재확인.
