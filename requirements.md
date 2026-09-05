# 배드민턴 예약 관리 시스템 — 요구사항 정의서 (최종 통합본)

원본 요구사항 23개 항목과 이후 논의로 확정된 개정사항(요구사항_v2.md)을 하나로 병합한 최종 스펙.
이 문서가 이후 모든 설계/구현/QA 단계의 기준(Single Source of Truth)이다.

---

## 1. 프로젝트 목표

회원가입 없이 사용자가 이름과 전화번호만으로 배드민턴 예약을 신청/취소할 수 있는 웹 시스템을 개발한다.
관리자는 환경변수로 지정한 비밀번호를 통해 관리자 페이지에 접근하며, 예약일 관리, 슬롯 관리, 연 멤버 관리, 월 멤버 관리, 예약 승인/취소를 수행한다.

## 2. 사용자 유형

**일반 사용자**
- 회원가입 없음
- 예약 가능한 날짜 조회
- 이름과 전화번호로 예약 신청
- 전화번호로 본인 예약 조회 후 취소 (2.1 참고)

**관리자**
- 별도 계정 없음
- 환경변수 `ADMIN_PASSWORD`로 로그인
- 관리자 페이지 접근 가능

```env
ADMIN_PASSWORD=your-password
```

### 2.1 공개 페이지 노출 정보 (확정)

- 같은 예약일의 다른 예약자 **이름은 전체 공개**한다 (동호회 특성상 마스킹 불필요).
- 전화번호는 비공개. 이름과 확정/대기 상태 정도만 노출한다.

## 3. 예약일 관리

관리자는 예약 가능한 날짜를 생성하고 관리할 수 있다.

**예약일 정보**
- 날짜 (`date`)
- 요일 (`dayOfWeek`) — **사용자 입력 아님. `date`로부터 서버가 자동 계산.**
- 세션 구분 라벨 (`label`, optional) — 예: "오전", "오후", "1부". 같은 날짜에 여러 세션을 허용하기 위한 필드.
- 시작 시간 (`startTime`) — "HH:mm" 24시간제 문자열(예: "18:00"). Pacific/Auckland 기준 벽시계 표시값으로, 날짜 계산에는 관여하지 않는다.
- 종료 시간 (`endTime`) — "HH:mm" 24시간제 문자열. `startTime`보다 늦어야 한다.
- 장소
- 듀티 담당자
- 예약 가능 여부
- 전체 예약 가능 인원 (`totalSlots`)
- 연 멤버 슬롯 수 (`annualSlots`)
- 캐주얼 슬롯 수 (`casualSlots`)
- 슬롯 정책 (`slotMode`)

**같은 날짜 다중 세션 정책 (확정)**
- `date`에 unique 제약을 두지 않는다. 같은 날짜에 여러 개의 BookingDay(세션)를 허용한다.

**슬롯 정책**

*분리 슬롯 (SEPARATED)*
연 멤버와 캐주얼 멤버 슬롯을 따로 관리한다. 저장 시 `totalSlots = annualSlots + casualSlots`를 검증한다.
예시: 전체 24명 = 연 멤버 16명 + 캐주얼 8명

*통합 슬롯 (COMBINED)*
연 멤버와 캐주얼 멤버가 전체 슬롯을 공유한다. `annualSlots`/`casualSlots`는 사용하지 않는다(0).
예시: 전체 24명, 연/캐주얼 구분 없이 24명

## 4. 연 멤버 관리

관리자는 연 멤버를 등록/수정/비활성화할 수 있다. 하드 삭제는 지원하지 않는다(확정). 화면상 "삭제" 액션이 있더라도 내부적으로는 `isActive=false` 처리이며, 레코드는 물리적으로 삭제되지 않는다. (사유: `Booking.matchedAnnualMemberId`, `MonthlyMember.annualMemberId`가 참조하므로 하드 삭제 시 참조 무결성/이력이 깨짐)

**연 멤버 정보**
- 이름
- 전화번호
- 활성 여부
- 메모

**연 멤버 판별 기준**
- 사용자가 입력한 이름 + 전화번호 조합이 등록된 연 멤버 정보와 모두 일치해야 한다.
- 이름만 일치하거나 전화번호만 일치하는 경우에는 캐주얼 멤버로 처리한다.
- 사용자는 직접 연 멤버/캐주얼 여부를 선택하지 않는다.
- 멤버 타입 판별은 반드시 서버에서 처리한다.
- 등록 시 `normalizedName + phoneHash` 조합에 유니크 제약을 둔다 (중복 등록 방지, phoneHash는 정규화된 전화번호의 결정론적 해시).

## 5. 월 멤버 관리

월 멤버는 특정 연도, 특정 월, 특정 요일에 우선적으로 자동 배정되는 멤버다.
관리자는 월 멤버를 등록/수정/비활성화/완전 삭제할 수 있다. 비활성화(`isActive=false`)와 완전 삭제(하드 삭제)는 서로 다른 액션으로 둘 다 제공한다(decisions.md D-26 — 연 멤버는 예약 이력이 참조하므로 하드 삭제를 지원하지 않지만, 월 멤버는 어떤 예약 레코드도 참조하지 않아 완전 삭제를 허용해도 이력 무결성에 영향이 없다).
수정 시 적용 연도/월/요일도 변경할 수 있으며, 대상(연 멤버)만 불변이다(decisions.md D-21). 변경 후 조합이 다른 레코드와 중복되면 거부된다.

**월 멤버 정보**
- 연 멤버
- 적용 연도
- 적용 월
- 적용 요일
- 활성 여부
- 메모

한 명의 연 멤버는 같은 월에 여러 요일의 월 멤버로 등록될 수 있다.
예시: 김민수/2026년 7월/화요일, 김민수/2026년 7월/목요일 → 허용

관리자는 연 멤버를 한 번 선택하고 적용 요일을 여러 개 동시에 체크해 한 번의 등록으로 여러 요일에 배정할 수 있다(decisions.md D-25). 이미 등록된 요일은 건너뛰고 나머지 요일은 정상 등록되는 부분 성공을 허용하며, 등록/건너뜀 결과를 요일별로 요약해 보여준다.

같은 멤버가 같은 연도, 같은 월, 같은 요일에 중복 등록되는 것은 막는다.
예시: 김민수/2026년 7월/화요일 두 번 등록 → 허용 안 함

**중복 방지 기준**
```ts
annualMemberId + year + month + dayOfWeek
```

## 6. 월 멤버 자동 배정

관리자가 예약일을 생성하면, 해당 예약일의 연도/월/요일과 일치하는 월 멤버를 자동으로 예약에 배정한다.

예시: 월 멤버(김민수/2026년 7월/화요일) 등록 + 예약일(2026년 7월 7일 화요일) 생성 → 김민수가 자동으로 예약에 추가된다.

월 멤버 자동 배정 예약은 기본적으로 슬롯이 있으면 `CONFIRMED`, 슬롯이 부족하면 `WAITING`으로 생성한다.
자동 배정 예약은 항상 `memberType = ANNUAL`로 처리하며, 분리 슬롯 모드에서는 연 멤버 슬롯을 소비한다.

**자동 배정 조건 (확정)**
- `MonthlyMember.isActive`뿐 아니라 연결된 `AnnualMember.isActive`도 함께 확인한다. 비활성 연 멤버는 자동배정에서 제외한다.

**자동 배정 실행 시점**
- 관리자가 예약일을 새로 생성할 때, 화면에서 "월 멤버를 자동으로 추가하시겠습니까?" 확인을 거쳐 관리자가 승인한 경우 (decisions.md D-19 — 같은 요일에 세션이 여러 개 열려도 월 멤버가 모든 세션에 중복 배정되지 않도록, 무조건 실행 대신 관리자 확인을 거친다. 확인을 취소하면 이 예약일은 자동 배정을 건너뛰고, 필요시 아래 수동 버튼으로 나중에 실행할 수 있다.)
- 관리자가 예약일 상세 페이지에서 "월 멤버 자동 배정" 버튼을 누를 때
- 관리자가 새 월 멤버를 등록할 때, 화면에서 "기존 예약일에도 자동으로 추가하시겠습니까?" 확인을 거쳐 승인한 경우 — 등록한 연/월/요일과 일치하는, 이미 생성되어 있는 예약일 전체에 소급 적용한다(decisions.md D-22, 같은 이유로 관리자 확인을 거친다). 단, 이미 종료된 예약일(decisions.md D-23)은 대상에서 제외한다.

(과거에는 월 멤버 관리 페이지에 특정 연/월 전체 예약일에 소급 일괄 배정하는 버튼이 있었으나, 위 트리거들만으로 충분히 커버되어 제거했다. 해당 화면의 요일 선택 UI는 이제 목록 필터 용도로만 쓰인다 — decisions.md D-20.)

**중복 예약 방지 (자동 배정 한정)**
- 같은 예약일에 동일한 이름 + 전화번호 조합의 예약이 이미 있으면 새로 만들지 않는다.
- `WAITING` 또는 `CONFIRMED` 상태가 이미 있으면 생성하지 않는다.
- `CANCELLED` 상태만 있으면 소스와 관계없이 새 예약을 재생성한다 (7.1 참고). 특정 멤버를 특정 요일 자동 배정에서 계속 제외하고 싶다면, 취소 이력에 의존하지 않고 관리자가 해당 월 멤버 등록을 비활성화하여 처리한다.

## 7. 사용자 예약

사용자는 이름과 전화번호만 입력해 예약한다.

**정규화 규칙 (확정)**
- 이름: trim (앞뒤 공백 제거)
- 전화번호: 숫자만 남김 (하이픈, 공백 제거)

**예약 생성 순서**
1. 이름 정규화
2. 전화번호 정규화
3. 연 멤버 목록 조회
4. 이름 + 전화번호가 모두 일치하면 `ANNUAL`
5. 아니면 `CASUAL`
6. 예약일 슬롯 정책 확인
7. 자리가 있으면 `CONFIRMED`
8. 자리가 없으면 `WAITING`
9. 참여자 영구 식별 코드를 발급/재사용한다(memberType과 무관, 27번 참고)

클라이언트에서 `memberType`을 전달하지 않는다. 서버가 직접 계산한다.

**전화번호 입력 UX (신규, 27.6번 참고)**
- 예약 신청 폼의 전화번호 입력칸에는 저장 형식 안내(`placeholder="0212345678"`)를 표시한다.
- 이름/전화번호 입력칸에는 브라우저 자동완성이 동작하도록 각각 `autoComplete="name"`, `autoComplete="tel"`을 지정한다.

**종료된 예약일 (decisions.md D-23)**
예약일의 `date + endTime`(Pacific/Auckland 기준)이 이미 지났으면, 사용자 셀프 신청은 거부된다("이미 종료된 예약일에는 신청할 수 없습니다."). 관리자 액션(`adminCreateBooking` 등)은 이 제한을 받지 않는다. 종료 여부와 무관하게 목록/상세 조회는 계속 가능하다("종료됨" 배지로 표시).

### 7.1 취소 후 재예약 정책 (확정)

- 사용자는 특정 예약일에 `CANCELLED` 이력이 있어도 **본인이 직접 다시 예약할 수 있다.**
- 같은 `bookingDayId + normalizedName + phoneHash` 조합에 `CANCELLED` 이력만 있는 경우, **`USER`/`ADMIN`/`MONTHLY_MEMBER_AUTO` 모든 소스에서** 새 예약 행 생성(재예약/재배정)을 허용한다. 소스별 예외를 두지 않는다.
- 월 멤버를 특정 요일 자동 배정에서 앞으로 계속 제외하고 싶다는 요청은 "그날의 취소"가 아니라 "월 멤버 등록 자체"에 대한 변경이므로, 관리자가 해당 월 멤버를 비활성화하여 처리한다.

## 8. 예약 상태

예약 상태는 다음 세 가지를 사용한다.

```ts
WAITING
CONFIRMED
CANCELLED
```

슬롯 계산에 포함되는 상태: `CONFIRMED`
슬롯 계산에서 제외되는 상태: `WAITING`, `CANCELLED`

## 9. 자동 승인 정책

예약 신청 시 슬롯이 남아 있으면 자동으로 `CONFIRMED` 처리한다.
슬롯이 가득 차 있으면 `WAITING`으로 처리한다.

분리 슬롯일 경우:
- `ANNUAL` 예약은 연 멤버 슬롯 기준으로 판단
- `CASUAL` 예약은 캐주얼 슬롯 기준으로 판단

통합 슬롯일 경우:
- 모든 예약이 전체 슬롯 기준으로 판단

분리 슬롯에서 연 ↔ 캐주얼 간 슬롯 교차는 없다 (연 슬롯이 남아도 캐주얼 대기자를 그 슬롯으로 승격하지 않음).

## 10. 대기 예약 관리

관리자는 `WAITING` 상태의 예약을 직접 승인할 수 있다.

승인 시: `WAITING -> CONFIRMED`

**MVP 기본 정책 (개정, decisions.md D-14)**
- 관리자의 승인은 슬롯 여유와 무관하게 항상 성공한다(강제 승인 지원, 관리자 액션 한정).
- 슬롯이 부족한 상태에서 승인하면, 해당 예약일의 슬롯 수를 자동으로 1 늘려서 확정한다.
  분리 슬롯(SEPARATED) 모드에서는 예약의 `memberType`에 해당하는 세부 슬롯
  (`annualSlots` 또는 `casualSlots`)과 `totalSlots`를 함께 1 늘려 `totalSlots = annualSlots + casualSlots` 불변식을 유지한다.
- 이 자동 슬롯 확장은 **관리자 액션(대기 승인, 관리자 수동 예약 추가)에만** 적용된다.
  사용자가 직접 신청하는 공개 예약 폼에는 적용되지 않으며, 슬롯이 없으면 기존과 동일하게 `WAITING`으로 등록된다.
- 관리자의 개별 승인은 FIFO 순서를 강제하지 않는다 (FIFO는 자동 승격 로직에만 적용).

## 11. 슬롯 증가 시 자동 승격

관리자가 특정 예약일의 슬롯 수를 늘리면, `WAITING` 예약을 신청 순서대로 자동 승인한다.

**승격 기준**
1. 먼저 신청한 사람 우선
2. 같은 시간이면 id가 작은 예약 우선

예시: 기존 슬롯 20명, 확정 20명, 대기 3명 → 슬롯을 22명으로 증가 → 대기자 2명 자동 `CONFIRMED`

## 12. 예약 취소 시 자동 승격

`CONFIRMED` 예약자가 취소하면, `WAITING` 목록에서 다음 순번 예약자가 자동으로 `CONFIRMED` 된다.

## 13. 슬롯 감소 정책 (개정, decisions.md D-15)

예약일 수정 시 입력한 슬롯 수가 현재 확정(`CONFIRMED`) 인원보다 적으면 저장 자체를 거부한다
(검증 오류, 예약일 수정이 반영되지 않음). 슬롯 수는 항상 확정 인원 이상으로만 설정할 수 있다.
분리 슬롯(SEPARATED) 모드에서는 `annualSlots`/`casualSlots`를 각각의 확정 인원과 비교해 풀별로 검증한다.

예시: 캐주얼 확정 인원이 3명인 상태에서 `casualSlots`를 1로 줄이려는 수정 요청은 거부된다.

기존 `CONFIRMED` 예약 자체가 수정으로 인해 자동으로 `WAITING`으로 바뀌는 일은 없다(이 규칙은 유지).
저장을 거부하는 시점에 막기 때문에, 확정 인원을 초과하는 슬롯 상태 자체가 발생하지 않는다.

## 14. 예약 취소

사용자는 본인 예약을 취소할 수 있다. 다만 전화번호만으로는 동일 번호의 여러 예약(다른 이름/다른 날짜)과 충돌할 수 있으므로 아래 2단계 플로우를 따른다.

**14.1 예약 조회**
- 입력: 전화번호
- 출력: 해당 번호로 된 예약 목록 (bookingId, 날짜, 이름, 상태)

**14.2 예약 취소**
- 입력: `bookingId` + 전화번호
- 서버는 입력한 전화번호를 정규화 후 `phoneHash`로 변환해, 해당 `bookingId`에 저장된 `phoneHash`와 일치할 때만 취소 처리 (평문 비교나 복호화 없이 해시 비교만으로 검증)
- 취소 시 예약 상태를 `CANCELLED`로 변경 (레코드 삭제하지 않음, `cancelledAt` 기록)
- 취소된 예약이 `CONFIRMED`였다면 대기자 자동 승격을 실행한다 (12번 참고)
- 예약일이 이미 종료되었으면(`date+endTime` 경과, decisions.md D-23) 사용자 셀프 취소는 거부된다("이미 종료된 예약일의 예약은 취소할 수 없습니다."). 관리자 취소(`adminCancelBooking`)는 이 제한을 받지 않는다.

## 15. 관리자 기능

관리자 페이지 기능:
- 관리자 로그인
- 대시보드
- 예약일 생성/수정/삭제
- 예약자 목록 조회
- 예약 상태 변경
- 대기 예약 승인
- 예약 취소 처리
- 연 멤버 등록/수정/비활성화
- 월 멤버 등록/수정/비활성화
- 월 멤버 자동 배정 실행
- 클럽데이 패턴 등록/수정/비활성화/삭제 (25번 참고)
- 결제 증빙 대리 업로드 및 결제 확인/확인 취소 처리 (26번 참고)
- 참여자 코드 CSV 내보내기 및 내보내기 제외 대상 관리, 내보내기 이력 확인 (27번 참고)

## 16. 관리자 대시보드 (경고 지표 개정, decisions.md D-16)

표시 정보:
- 오늘 예약 현황
- 날짜별 예약 인원
- 확정 인원
- 대기 인원
- 취소 인원
- 슬롯 사용률
- 대기 인원 발생 경고 — `WAITING` 상태 예약이 있는 예약일을 강조 표시한다. D-14(관리자 액션 시
  슬롯 자동 확장)와 D-15(슬롯 감소 시 확정 인원 미만 저장 차단)로 인해 "확정 인원이 슬롯 수를
  초과"하는 상태는 앱의 정상 동작으로는 더 이상 발생하지 않으므로, 기존 "슬롯 초과 경고" 대신
  이 지표를 사용한다.

## 17. 데이터 모델

```ts
AnnualMember {
  id
  name
  normalizedName
  phoneHash        // HMAC-SHA256(정규화된 전화번호), 조회/중복확인/일치판정용 결정론적 해시. 평문 저장 안 함(확정, decisions.md D-10)
  phoneEncrypted   // AES-256-GCM(정규화된 전화번호), 관리자 열람 시에만 복호화
  isActive
  memo
  createdAt
  updatedAt

  @@unique([normalizedName, phoneHash])
}

MonthlyMember {
  id
  annualMemberId
  year
  month
  dayOfWeek
  isActive
  memo
  createdAt
  updatedAt

  @@unique([annualMemberId, year, month, dayOfWeek])
}

ClubDayPattern {
  id
  name                     // optional, 관리자 식별용 자유 텍스트
  dayOfWeek                // 0(일)~6(토)
  label                    // optional, 생성되는 BookingDay.label에 그대로 복사
  startTime                // "HH:mm"
  endTime                  // "HH:mm", startTime보다 늦어야 함
  location
  dutyPerson
  totalSlots
  annualSlots
  casualSlots
  slotMode                 // SEPARATED | COMBINED
  autoAssignMonthlyMembers // boolean, 기본값 true (decisions.md D-30)
  isActive                 // boolean, 기본값 true — 크론 생성 대상 여부
  deletedAt                // nullable, "삭제" 액션 시각. null이 아니면 목록에서 숨김(decisions.md D-29)
  createdAt
  updatedAt
  // 요일당 여러 패턴 등록 가능 (unique 제약 없음)
}

BookingDay {
  id
  date
  dayOfWeek       // 서버 계산, 입력 불가
  label           // optional, 같은 날짜 다중 세션 구분용
  startTime       // "HH:mm", Pacific/Auckland 벽시계 표시값
  endTime         // "HH:mm", startTime보다 늦어야 함
  location
  dutyPerson
  totalSlots
  annualSlots
  casualSlots
  slotMode        // SEPARATED | COMBINED
  isOpen
  clubDayPatternId // nullable, ClubDayPattern을 가리키는 "약한 참조"(FK 제약 없음, decisions.md D-28).
                    // null이 아니면 클럽데이(크론 자동 생성), null이면 관리자가 수동 생성한 일반 예약일.
                    // 별도의 isClubDay boolean 필드는 두지 않는다.
  createdAt
  updatedAt
  // date에 unique 제약 없음 (다중 세션 허용)
}

Booking {
  id
  bookingDayId
  name
  normalizedName
  phoneHash         // HMAC-SHA256(정규화된 전화번호), 조회/중복확인/취소검증용
  phoneEncrypted    // AES-256-GCM(정규화된 전화번호), 관리자 열람 시에만 복호화
  memberType        // ANNUAL | CASUAL
  matchedAnnualMemberId
  status            // WAITING | CONFIRMED | CANCELLED
  source            // USER | ADMIN | MONTHLY_MEMBER_AUTO
  paymentConfirmed    // boolean, 기본 false. 결제 확인 처리 여부 (26번, decisions.md D-31)
  paymentConfirmedAt  // nullable, paymentConfirmed=true로 바뀐 시각. 확인 취소 시 다시 null
  createdAt
  updatedAt
  cancelledAt
}

PaymentProof {
  id
  bookingId    // Booking과 1:1 (unique)
  imageData    // base64 인코딩된 이미지 데이터 (decisions.md D-32, base64-in-Turso)
  mimeType     // "image/jpeg" | "image/png" | "image/webp"
  uploadedBy   // SELF | ADMIN
  createdAt
  updatedAt    // 재업로드(교체) 시 갱신
}

ParticipantCode {
  id
  name                 // 표시용, 생성 시점의 정규화된 이름으로 고정(신원 키의 일부라 이후 갱신되지 않음)
  normalizedName
  phoneHash            // HMAC-SHA256(정규화된 전화번호) — Booking/AnnualMember와 동일한 신원 키(27번, decisions.md D-33)
  phoneEncrypted       // AES-256-GCM(정규화된 전화번호) — CSV 내보내기(27.5번) 시에만 복호화
  code                 // 12자 랜덤 문자열, 유니크. QR에 담기는 값(이 값만 인코딩, 이름/전화번호 미포함)
  excludedFromExport   // boolean, 기본 false. true면 CSV 내보내기(27.5번)에서 제외. 관리자가 화면에서 토글하며,
                        // 껐다 켜기 전까지 영구적으로 유지된다(신규, requirements.md 27.5번, decisions.md D-34)
  createdAt
  updatedAt

  @@unique([normalizedName, phoneHash])
}

ParticipantCodeExportLog {
  id
  exportedAt     // CSV를 실제로 생성해 응답한 시각
  exportedCount  // 그 시점에 CSV에 담긴 행 수(excludedFromExport=false 필터 반영 후 실제 건수)
}
```

**전화번호 저장 방식 (확정, decisions.md D-10)**
전화번호는 DB에 평문으로 저장하지 않는다. 정규화된 전화번호로부터 두 값을 계산해 저장한다.
- `phoneHash`: 서버 비밀키 기반 HMAC-SHA256. 같은 입력은 항상 같은 값이 나오므로(결정론적) 중복확인/멤버 판별/취소 시 본인확인 등 "일치 여부"만 필요한 모든 로직은 이 값으로 비교하며, 복호화가 필요 없다.
- `phoneEncrypted`: AES-256-GCM으로 암호화한 값. 관리자가 예약자 목록에서 실제 전화번호를 확인(연락)해야 할 때만 복호화한다. 이름은 공개 페이지에 그대로 노출되는 정보(2.1, D-04)라 암호화 대상이 아니다.

## 18. 중복 예약 방지

같은 예약일에는 동일한 이름 + 전화번호 조합으로 중복 예약할 수 없다.

**중복 방지 기준**
```ts
bookingDayId + normalizedName + phoneHash
```

**판정 로직 (확정)**
- 같은 조합에 `WAITING` 또는 `CONFIRMED`가 있으면 → 항상 거부 (중복)
- 같은 조합에 `CANCELLED`만 있는 경우 → **source와 관계없이** 새 행으로 생성 허용 (재예약/재배정)

## 19. 주요 서비스 함수

### determineMemberType
```ts
determineMemberType(name: string, phone: string)
```
- 이름 정규화
- 전화번호 정규화 → `phoneHash` 계산
- 활성 연 멤버 조회
- 이름 + `phoneHash`가 모두 일치하면 `ANNUAL`
- 아니면 `CASUAL`

### createBooking
```ts
createBooking(bookingDayId, name, phone, source)
```
1. 이름/전화번호 정규화 → `phoneHash`(HMAC), `phoneEncrypted`(AES-GCM) 계산
2. 기존 예약 조회 (bookingDayId + normalizedName + phoneHash)
3. `WAITING`/`CONFIRMED` 존재 → reject (중복)
4. `CANCELLED`만 존재 → source와 관계없이 새 행 생성 진행
5. `determineMemberType(name, phone)` → `ANNUAL` | `CASUAL`
6. 슬롯 정책 확인 (SEPARATED/COMBINED, memberType 반영)
7. 여유 있으면 `CONFIRMED`, 없으면 `WAITING`
8. `phoneHash`/`phoneEncrypted`로 저장 (평문 phone/normalizedPhone은 저장하지 않음)
9. DB Transaction 내 처리

### cancelBooking
```ts
cancelBooking(bookingId, phone)
```
1. `bookingId`로 예약 조회
2. 입력 전화번호 정규화 후 `phoneHash` 계산 → `booking.phoneHash`와 일치 확인 (불일치 시 reject, 복호화 불필요)
3. status를 `CANCELLED`로 변경 (`cancelledAt` 기록, 레코드 삭제하지 않음)
4. 취소된 예약이 `CONFIRMED`였다면 `promoteWaitingBookings(bookingDayId)` 호출
5. DB Transaction 내 처리

### lookupBookingsByPhone
```ts
lookupBookingsByPhone(phone)
```
1. 전화번호 정규화 → `phoneHash` 계산
2. `phoneHash` 일치하는 예약 목록 조회 (bookingId, date, name, status) — 저장된 값을 복호화하지 않고 해시로만 비교
3. 취소 대상 선택을 위해 사용자에게 반환

### promoteWaitingBookings
```ts
promoteWaitingBookings(bookingDayId)
```
- 예약일 슬롯 정책 확인
- 남은 슬롯 계산
- 대기자를 신청 순서대로 자동 확정
- 분리 슬롯/통합 슬롯 정책 반영 (풀 간 교차 승격 없음)

### isPaymentConfirmationRequired
```ts
isPaymentConfirmationRequired(booking, bookingDay)
```
- `booking.memberType`이 `CASUAL`이면(또는 `matchedAnnualMemberId`가 없으면) 항상 `true`
- `ANNUAL`이면, 이 예약일의 (연도, 월, 요일)과 일치하는 활성 `MonthlyMember`가 `matchedAnnualMemberId`에 연결되어 있는지 조회 — 있으면 `false`(면제), 없으면 `true`(월 멤버로 미등록된 순수 연 멤버이거나 본인 등록 요일이 아닌 날)
- 목록 조회(관리자 예약자 목록, 전화번호 조회)에서는 N+1 쿼리를 피하기 위해 여러 예약을 배치로 한 번에 판정한다(26번 참고)

### getPaymentAmountDue
```ts
getPaymentAmountDue(memberType: MemberType, paymentConfirmationRequired: boolean): number
```
- 순수 함수. DB 조회 없음(26.7번 참고).
- `paymentConfirmationRequired`가 `false`면 `0`.
- `true`이고 `memberType === "CASUAL"`이면 `16`, `"ANNUAL"`이면 `13`(고정 상수).
- `lookupBookingsByPhone`/`listBookingsForAdmin`이 각 예약 DTO에 `paymentAmountDue` 필드로 포함시켜 반환한다.

### uploadPaymentProof
```ts
uploadPaymentProof(bookingId, file, uploadedBy: "SELF" | "ADMIN", phone?)
```
- `uploadedBy === "SELF"`이면 `phone`을 정규화 후 `phoneHash`로 변환해 `booking.phoneHash`와 일치할 때만 진행(취소 검증과 동일한 방식). `uploadedBy === "ADMIN"`이면 이 검증을 생략한다.
- 대상 예약이 `CANCELLED` 상태면 거부한다. 예약일 종료 여부(`isBookingDayEnded`)는 검사하지 않는다 — 결제 증빙 업로드는 예약일 종료와 무관하게 항상 허용한다(26번 참고).
- 파일 MIME 타입이 이미지(jpeg/png/webp)가 아니거나 2MB를 초과하면 거부한다.
- 기존 `PaymentProof`가 있으면 교체(재업로드 허용), 없으면 새로 생성한다. 업로드 자체는 `paymentConfirmed` 상태를 변경하지 않는다.

### setPaymentConfirmation
```ts
setPaymentConfirmation(bookingId, confirmed: boolean)
```
- 관리자 전용. `paymentConfirmed`와 `paymentConfirmedAt`(확인 시 현재 시각, 확인 취소 시 `null`)을 갱신한다.
- 증빙 이미지 존재 여부와 무관하게 항상 허용한다(관리자가 대면으로 확인한 경우 등, decisions.md D-31).

### applyMonthlyMembersToBookingDay
```ts
applyMonthlyMembersToBookingDay(bookingDayId)
```
- 예약일의 연도/월/요일 확인
- 해당 조건과 일치하는 활성 월 멤버 조회 (`MonthlyMember.isActive` AND `AnnualMember.isActive`)
- 중복 예약 확인
- 예약 자동 생성 (source = `MONTHLY_MEMBER_AUTO`)
- 슬롯이 있으면 `CONFIRMED`, 없으면 `WAITING`
- 대상 월 멤버 전원에 대해 `ensureParticipantCodesBatch`를 같은 트랜잭션에서 호출해 참여자 코드를 배치로 발급/재사용한다(27번 참고)
- 결과로 생성 수, 스킵 수 반환

### ensureParticipantCode (신규, 27번, decisions.md D-33)
```ts
ensureParticipantCode(name: string, phone: string)
```
- 이름/전화번호 정규화 → `phoneHash` 계산
- `normalizedName + phoneHash` 조합으로 기존 `ParticipantCode` 조회
- 있으면: 기존 행을 그대로 반환(재발급하지 않음), 어떤 필드도 갱신하지 않는다. `name`은 신원 키(`normalizedName`)의 일부와 항상 같은 값으로만 생성되므로 갱신할 대상 자체가 없고, `phoneEncrypted`도 재암호화하지 않는다(phoneHash가 이미 일치하므로 평문 값이 동일함이 보장됨)
- 없으면: 12자 랜덤 문자열(`code`)을 생성해 새로 등록 후 반환. 동시 요청으로 인한 유니크 충돌(같은 신원이 동시에 두 트랜잭션에서 최초 생성 시도) 발생 시 재조회해 기존 값을 반환한다
- `createBooking`/`adminCreateBooking`(단건 예약 생성 경로) 내부에서 예약 생성과 같은 트랜잭션으로 호출되며, 반환된 `code`는 `participantCode` 필드로 예약 응답 DTO에 포함된다

### ensureParticipantCodesBatch (신규, 27번, decisions.md D-33)
```ts
ensureParticipantCodesBatch(participants: { name: string; phone: string }[])
```
- `applyMonthlyMembersToBookingDay`(월 멤버 자동 배정)처럼 여러 명을 한 번에 처리하는 경로에서 N+1 쿼리를 피하기 위한 배치 버전(`batchComputePaymentConfirmationRequirements`와 동일한 이유, 19번 참고)
- 대상 전체의 `normalizedName + phoneHash` 조합을 한 번의 조회로 기존 등록 여부를 확인하고, 없는 조합만 모아 한 번의 `createMany`로 코드를 발급한다(신원 개수만큼 조건을 쌓지 않고 테이블 전체를 조회해 메모리에서 대조 — 대량 배치에서 SQLite 표현식 트리 깊이 제한에 걸리는 것을 피하기 위함, architecture.md 참고)
- 단건 경로(`ensureParticipantCode`)와 동일하게 기존 행은 갱신 없이 그대로 재사용한다
- 반환값은 호출자가 사용하지 않는다(코드 발급/재사용 자체가 목적)

### listParticipantCodesForExport (신규, 27.5번, decisions.md D-34)
```ts
listParticipantCodesForExport()
```
- `ParticipantCode` 중 `excludedFromExport = false`인 행만 이름 오름차순으로 조회 (활성/비활성, memberType 등 그 외 필터는 없음 — 개별 제외 설정만 적용, decisions.md D-34 개정)
- 각 행의 `phoneEncrypted`를 복호화해 `{ code, name, phone }` 형태로 반환 (관리자 CSV 내보내기 전용, 다른 목적으로 호출하지 않음)

### listParticipantCodesForAdmin (신규, 27.5번, decisions.md D-34)
```ts
listParticipantCodesForAdmin()
```
- `ParticipantCode` 전체(제외 설정된 행 포함)를 이름 오름차순으로 조회
- 각 행의 `phoneEncrypted`를 복호화해 `{ id, code, name, phone, excludedFromExport }` 형태로 반환 (관리자 화면(`/admin/participant-codes`) 목록 렌더링 전용 — CSV 내보내기(`listParticipantCodesForExport`)와 달리 제외된 행도 화면에서는 계속 보여야 관리자가 토글을 다시 켤 수 있음)

### setParticipantCodeExclusion (신규, 27.5번, decisions.md D-34)
```ts
setParticipantCodeExclusion(id: string, excludedFromExport: boolean)
```
- 관리자 전용. 대상 `ParticipantCode`의 `excludedFromExport`를 갱신한다
- 이 설정은 명시적으로 다시 켜기 전까지 영구적으로 유지되며, CSV를 내려받을 때마다 매번 다시 선택하는 것이 아니다
- `code`/`normalizedName`/`phoneHash` 등 다른 필드는 변경하지 않는다(제외 여부만 다루는 단일 목적 함수)

### deleteParticipantCode (신규, 27.5.4번)
```ts
deleteParticipantCode(id: string)
```
- 관리자 전용. 대상 `ParticipantCode` 행을 완전히 삭제한다(존재하지 않으면 `NotFoundError`)
- 되돌릴 수 없다 — 같은 신원이 나중에 다시 예약하면 `ensureParticipantCode`가 새 코드를 발급할 뿐, 삭제 전 코드가 복구되지는 않는다

### recordParticipantCodeExport (신규, 27.5.3번, decisions.md D-34)
```ts
recordParticipantCodeExport(exportedCount: number)
```
- `listParticipantCodesForExport()`가 CSV로 응답을 실제로 만들어 보내는 시점에만 호출한다(단순 화면 조회/목록 렌더링에서는 호출하지 않음)
- `ParticipantCodeExportLog`에 `{ exportedAt: now(), exportedCount }` 한 건을 생성한다. "누가" 내려받았는지는 기록하지 않는다(관리자 단일 계정 체제, 27.5.3번 참고)

### listParticipantCodeExportLogs (신규, 27.5.3번, decisions.md D-34)
```ts
listParticipantCodeExportLogs(limit?: number)
```
- `ParticipantCodeExportLog`를 `exportedAt` 내림차순으로 조회(기본 최근 1건 이상). 관리자 화면(`/admin/participant-codes`)이 최근 내보내기 이력을 보여줄 때 사용한다

## 20. 동시성 처리

다음 작업은 반드시 DB Transaction 안에서 처리한다.
- 예약 생성
- 예약 취소
- 관리자 승인
- 슬롯 변경
- 월 멤버 자동 배정
- 대기자 자동 승격

동시 예약이 발생해도 예약 가능 인원을 초과하지 않도록 한다.

참여자 코드 발급/재사용(`ensureParticipantCode`/`ensureParticipantCodesBatch`, 27번)은 별도 트랜잭션이 아니라 위 "예약 생성"/"월 멤버 자동 배정" 트랜잭션 안에서 함께 수행된다(예약 생성과 코드 발급이 분리되어 한쪽만 성공하는 상태를 방지).

## 21. 기술 스택

**Frontend**
- Next.js
- React
- Tailwind CSS
- shadcn/ui

**Backend**
- Next.js Route Handlers
- 스케줄러: Vercel Cron — 클럽데이 자동 생성 전용으로 매일 1회(뉴질랜드 기준 오후 10:30, 22:30경) 실행된다(decisions.md D-27). 이 프로젝트의 기존 원칙("별도 백그라운드 인프라 없이 요청 시점에 계산", 예: `isBookingDayEnded`, 대시보드 집계)에 대한 예외이며, 실제로 정해진 시각에 새 레코드를 써야 하는 이번 요구에만 한정해서 적용한다.

**Database**
- Turso (libSQL, SQLite 호환 서버리스 DB). 로컬 SQLite 파일 대신 사용한다 (확정, decisions.md D-09 참고). 스키마/쿼리 문법은 SQLite와 동일하며 Prisma의 sqlite 커넥터를 그대로 사용한다.

**ORM**
- Prisma (libSQL 드라이버 어댑터 `@prisma/adapter-libsql` 사용)

**Auth**
- 환경변수 `ADMIN_PASSWORD`(평문). 관리자 1인 체제, DB에는 저장하지 않고 Vercel 환경변수로만 관리한다 (검토했던 해시 방식은 decisions.md D-11/D-13 참고 — MVP 규모에서는 설정 편의를 우선해 평문 유지로 최종 결정).
- 서명된(signed) HttpOnly Cookie 기반 관리자 세션 (DB 세션 테이블 없음, 만료 예시 24시간)

**데이터 보호 (확정, decisions.md D-10)**
- 전화번호는 DB에 평문으로 저장하지 않는다. 조회/중복확인용 `phoneHash`(HMAC-SHA256)와 관리자 열람용 `phoneEncrypted`(AES-256-GCM)로 분리 저장한다 (17번 데이터 모델 참고). 이름은 공개 페이지에 그대로 노출되는 정보(2.1)라 암호화 대상이 아니다.
- 암복호화/해시에 사용하는 마스터 키는 환경변수 `PII_SECRET_KEY`로 관리한다. 이 키가 유출되면 즉시 교체(rotate)하고 기존 데이터를 재암호화해야 한다.

**타임존**
- Pacific/Auckland(뉴질랜드) 고정. 날짜/요일 계산 및 "오늘" 대시보드 기준. 서머타임(NZDT/NZST)을 사용하므로 고정 offset이 아닌 IANA 타임존 이름으로 처리한다.

**Deployment (확정, decisions.md D-09)**
- Vercel (Hobby 플랜, 무료) — Next.js 앱을 그대로 배포
- DB는 Turso(무료 티어)에 호스팅, 환경변수 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`으로 연결
- Docker/자체 서버 배포는 사용하지 않는다 (기존 계획 변경: 무료 운영을 위해 서버리스 방식으로 전환)
- 상세 배포 구성(환경변수 전체 목록, 마이그레이션 워크플로우, 대안 검토 등)은 `deployment.md`에서 별도 관리한다(배포 대상은 이후 바뀔 수 있음, D-12).

## 22. 개발 우선순위

1. 관리자 로그인
2. 예약일 생성
3. 사용자 예약 신청
4. 자동 승인 / 대기 처리
5. 예약 취소
6. 관리자 예약 관리
7. 연 멤버 관리
8. 월 멤버 관리
9. 월 멤버 자동 배정
10. 슬롯 분리 / 통합 정책
11. 관리자 대시보드
12. UI/UX 개선

## 23. 개발 지시사항 (요약)

위 요구사항을 바탕으로 배드민턴 예약 관리 시스템 MVP를 구현한다.
- 회원가입 없음. 사용자는 이름과 전화번호만으로 예약.
- 관리자는 환경변수 `ADMIN_PASSWORD`로 로그인.
- 사용자는 연 멤버/캐주얼 여부를 선택하지 않음. 서버가 이름+전화번호로 직접 판별.
- 예약 시 슬롯이 남아 있으면 `CONFIRMED`, 없으면 `WAITING`.
- 슬롯 증가/예약 취소 시 대기자를 신청 순서대로 자동 승격.
- 월 멤버는 연도/월/요일 기준으로 자동 배정되며, 한 멤버가 같은 월에 여러 요일로 등록 가능하나 (연도,월,요일) 조합은 중복 불가.
- 예약일 생성 시 연도/월/요일이 일치하는 월 멤버를 자동으로 예약에 추가.
- 예약 생성/취소/승인/슬롯 변경/월 멤버 자동 배정은 모두 DB Transaction 안에서 처리.
- 코드는 도메인별 Service 계층으로 분리 (유지보수 용이성 확보).

## 24. 다국어 지원 (공개 화면, decisions.md D-18)

- 일반 사용자에게 노출되는 공개 화면(예약일 목록/상세, 예약 신청, 내 예약 조회/취소)은 한국어와 영어를 모두 지원한다.
- 관리자 화면(`/admin/**`)은 이번 범위에서 제외하며 한글만 유지한다.
- 화면 우측 상단의 언어 전환 버튼으로 즉시 전환하며, 선택한 언어는 브라우저에 저장되어 다음 방문 시에도 유지된다.
- 예약일의 `label`(세션 라벨)처럼 관리자가 직접 입력한 자유 텍스트는 번역 대상이 아니다(UI 문구가 아닌 데이터이므로 입력된 그대로 표시).

## 25. 클럽데이 자동 생성 (decisions.md D-27~D-30)

### 25.1 개념

"클럽데이"는 반복 패턴(`ClubDayPattern`)으로부터 크론이 매일 자동으로 생성하는 예약일이다. 관리자가 매번 수동으로 만드는 기존 1회성 예약일과 구분되며, `BookingDay.clubDayPatternId`가 채워져 있으면 클럽데이, `null`이면 일반 예약일이다(별도 boolean 필드 없음, decisions.md D-28).

### 25.2 클럽데이 패턴 관리

관리자는 별도 화면(`/admin/club-day-patterns`)에서 반복 패턴을 등록/수정/비활성화/삭제할 수 있다. 요일별로 패턴을 여러 개 등록할 수 있다(예: 월요일 A체육관 패턴 + 월요일 B체육관 패턴).

**클럽데이 패턴 정보**
- 이름(`name`, optional) — 관리자 식별용 자유 텍스트(예: "월요일 A체육관 저녁")
- 요일(`dayOfWeek`) — 0(일)~6(토)
- 세션 라벨(`label`, optional) — 생성되는 예약일의 `label`에 그대로 복사된다
- 시작 시간(`startTime`) / 종료 시간(`endTime`) — "HH:mm", 예약일과 동일한 검증 규칙(종료가 시작보다 늦어야 함, 3번 참고)
- 장소(`location`) / 듀티 담당자(`dutyPerson`)
- 전체/연/캐주얼 슬롯 수, 슬롯 정책(`slotMode`) — 예약일 생성과 동일한 검증 규칙 적용(3번 참고)
- 월 멤버 자동 배정 여부(`autoAssignMonthlyMembers`, 기본값 true) — 이 패턴에서 파생되는 모든 클럽데이 회차에 공통 적용된다(decisions.md D-30). 회차마다 다시 묻지 않는다.
- 활성 여부(`isActive`)
- 삭제 여부(`deletedAt`) — UI의 "삭제" 액션 시각을 기록. `null`이면 목록에 노출, 값이 있으면 목록에서 숨김(decisions.md D-29)

**"비활성화"와 "삭제" (decisions.md D-29)**
- 비활성화: `isActive=false`로 토글. 목록에는 "비활성" 배지로 계속 표시되고, 재활성화 가능. 크론은 `isActive=true`인 패턴만 생성 대상으로 삼는다.
- 삭제: `deletedAt`에 시각을 기록(`isActive`도 함께 false 처리). 목록에서 완전히 사라지며 UI에서 되돌릴 방법은 없다. 단, DB row 자체는 지우지 않는다(하드 삭제 아님) — 과거 클럽데이가 참조하는 `clubDayPatternId`가 가리키는 대상이 갑자기 사라지지 않도록 하기 위함이다.

두 액션 모두 물리적으로 레코드를 삭제하지 않는다는 점에서 `AnnualMember`(D-07)와 같지만, `MonthlyMember`(D-26)처럼 "비활성화"와 "삭제"를 UI에서 별개 버튼으로 제공한다는 점은 다르다.

### 25.3 생성 + 공개 로직 (크론)

매일 1회(뉴질랜드 기준 오후 10:30, 22:30경) 실행되는 크론이, 실행 시점의 Pacific/Auckland 기준 "오늘"에 2일을 더한 날짜("모레")와 그 요일을 계산해, 그 요일과 일치하는 활성 패턴(`isActive=true`, `deletedAt=null`)을 모두 찾는다(decisions.md D-27 개정 — 회원이 예약할 수 있는 시간을 최소 이틀 확보하기 위함). 예: 월요일 22:30에 크론이 실행되면 수요일 클럽데이가 생성된다. 각 패턴에 대해:

1. 이미 그 날짜(모레)로 생성된 적이 있는지 확인한다(`clubDayPatternId` + `date` 조합, decisions.md D-28). 이미 있으면 건너뛴다(멱등성 보장 — 크론이 하루에 두 번 이상 실행돼도 중복 생성되지 않는다).
2. 없으면 패턴의 필드값을 그대로 복사해 `BookingDay`를 생성한다. 이때 `isOpen`은 항상 `true`다 — "생성"과 "공개"가 한 스텝으로 동시에 일어난다(decisions.md D-27, "미리 생성해두고 나중에 공개 전환"하는 방식이 아니다).
3. 패턴의 `autoAssignMonthlyMembers`가 `true`면, 생성 직후 같은 트랜잭션 안에서 `applyMonthlyMembersToBookingDay`를 실행한다(19번 참고).

패턴 하나의 생성 처리는 하나의 DB 트랜잭션으로 묶이며, 한 패턴의 처리가 실패해도 다른 패턴의 처리에는 영향을 주지 않는다(20번 동시성 처리 원칙과 동일).

### 25.4 휴무/예외 처리

특정 날짜만 쉬고 싶으면, 그날 크론이 생성한 `BookingDay`를 기존 "예약일 삭제" 기능(3번, decisions.md D-17)으로 지우면 된다. 별도의 "이번 회차만 건너뛰기" 기능은 제공하지 않는다.

### 25.5 패턴 수정/중단의 영향 범위

클럽데이는 "미리 생성해 둔 미래 회차"라는 개념이 없다(매일 그날치만 생성). 따라서 패턴을 수정하거나 비활성화해도 정리해야 할 기존 생성분이 없다.
- 패턴을 수정하면 다음 크론 실행부터 새 설정이 반영된다. 이미 생성된 과거 `BookingDay`는 생성 시점의 값을 그대로 유지한다(패턴과 실시간으로 동기화되지 않는다).
- 패턴을 비활성화하면 다음 크론 실행부터 그 패턴으로는 더 이상 생성되지 않는다.

### 25.6 크론 라우트 인증

크론 라우트(`GET /api/cron/club-days`)는 관리자 세션 미들웨어가 보호하는 `/api/admin/*` 바깥에 위치하며, 대신 Vercel이 크론 호출 시 자동으로 실어 보내는 `Authorization: Bearer {CRON_SECRET}` 헤더를 라우트 핸들러 내부에서 직접 검증한다(decisions.md D-27). 헤더가 없거나 환경변수 `CRON_SECRET`과 일치하지 않으면 401로 거부한다.

## 26. 회원 결제 확인 (decisions.md D-31~D-32)

### 26.1 목적

예약된 회원이 실제로 입금(송금)했는지 관리자가 확인할 수 있어야 한다. 회원이 송금 스크린샷을 업로드하면 관리자가 보고 수동으로 "확인" 처리하는 방식이며, 체크인 기능(별도 브랜치, 이번 범위 아님)과는 완전히 독립적으로 동작한다 — 결제 확인 여부가 체크인의 게이트 조건이 되지 않는다.

### 26.2 대상 범위 및 면제 규칙

모든 예약일 유형(클럽데이 포함)의 모든 예약(`CONFIRMED`/`WAITING`, `CANCELLED` 제외)에 적용한다. 다만 **월 멤버가 본인이 등록된 요일에 참여하는 경우에만 면제**한다.

- **캐주얼(`CASUAL`) 예약**: 항상 결제 확인 대상.
- **연 멤버(`ANNUAL`) 예약 중, 그 예약일의 (연도, 월, 요일)과 일치하는 활성 `MonthlyMember`로 등록되어 있는 경우**: 면제.
- **연 멤버(`ANNUAL`) 예약 중, 위 조건을 만족하지 않는 경우** (월 멤버로 아예 등록되지 않은 순수 연 멤버, 또는 월 멤버이지만 본인 등록 요일이 아닌 날 참여): 결제 확인 대상. 월 멤버 미등록 연 멤버는 면제받을 "본인 요일" 자체가 없으므로 항상 대상이라는 뜻이다(19번 `isPaymentConfirmationRequired` 참고).

판정은 예약 생성 시점에 결과를 저장하는 것이 아니라, 조회 시점에 매번 계산한다(요청 시점 계산 우선 원칙). 월 멤버 등록/비활성화가 나중에 바뀌어도 과거 예약의 확인 필요 여부가 그 시점 기준으로 재계산된다.

### 26.3 업로드 주체

- **회원 셀프 업로드**: 공개 "내 예약 조회/취소" 화면(`CancelLookup`)에서 조회한 본인 예약 중 `CONFIRMED` 상태인 행에만 업로드 버튼을 제공한다. 업로드 시 조회에 사용한 전화번호로 `phoneHash` 검증을 거친다(취소와 동일한 방식).
- **관리자 대리 업로드**: 관리자 예약 관리 화면(`AdminBookingsPanel`)에서 회원이 보여준 화면/사진을 관리자가 직접 첨부할 수 있다. 전화번호 검증은 필요 없다. 마찬가지로 `CONFIRMED` 상태인 예약에만 대리 업로드 버튼을 제공한다.
- 둘 다 기존 증빙이 있으면 새 업로드로 교체한다(재업로드 허용, "반려 후 재요청" 같은 별도 플로우는 없음).
- **업로드는 `CONFIRMED` 상태의 예약에만 허용한다.** `WAITING` 예약은 아직 확정되지 않아 미리 입금할 필요가 없고, `CANCELLED` 예약은 대상에서 완전히 제외되므로 둘 다 업로드를 거부한다(`uploadPaymentProof` 서버 검증, `ConflictError`: "확정된 예약만 결제 증빙을 업로드할 수 있습니다."). 셀프/대리 업로드 라우트가 공유하는 `lib/services/paymentProofService.ts`의 `uploadPaymentProof` 한 곳에서 검증하므로 두 경로 모두 동일하게 적용된다. 상태는 `WAITING` → `CONFIRMED`로만 전진하므로(decisions.md 참고) 한 번 업로드된 증빙이 나중에 `WAITING`으로 되돌아가 무효화되는 경우는 없다.
- **예약일 종료 여부와 무관하게 항상 업로드를 허용한다** — 취소(14번, D-23)와 달리 결제 증빙은 세션이 끝난 뒤에도 사후에 남길 수 있어야 하므로 `isBookingDayEnded` 검사를 적용하지 않는다(단, 위 `CONFIRMED` 상태 제약은 별도로 적용된다).

### 26.4 상태와 관리자 액션

- 상태는 "확인"(`paymentConfirmed=true`)/"미확인"(`paymentConfirmed=false`) 두 가지뿐이다. "반려" 상태나 재업로드 요청 플로우는 없다.
- 관리자만 상태를 변경할 수 있다. 증빙 이미지를 보고 "결제 확인" 버튼을 누르면 확인 처리되고, 실수로 확인했거나 취소 등의 사유로 되돌려야 하면 "확인 취소" 버튼으로 다시 미확인 상태로 되돌릴 수 있다(관리자 액션의 사후 정정 허용, decisions.md D-14/D-23과 일관).
- 증빙 이미지가 없어도 관리자는 확인 처리할 수 있다(대면 확인 등).
- 자동 검증(OCR 등)은 하지 않는다 — 관리자가 이미지를 직접 보고 수동으로 판단한다.

### 26.5 증빙 이미지 저장 방식 (decisions.md D-32)

증빙 이미지는 별도 오브젝트 스토리지(Vercel Blob 등) 없이 **Turso DB에 base64 문자열로 저장**한다(`PaymentProof.imageData`). 업로드 전 클라이언트에서 이미지를 리사이즈/재인코딩해 용량을 줄이는 것을 구현 조건으로 한다(17·19번 데이터 모델/서비스 함수, decisions.md D-32 참고). 서버는 파일당 2MB 상한을 강제한다.

### 26.6 UI 배치

- 공개: `CancelLookup`의 예약 목록 테이블에 "결제확인" 열/버튼을 추가한다. 면제 대상은 배지로 "면제" 표시만 하고 버튼을 노출하지 않는다. 대상인데 미확인이면 업로드 버튼과 상태 배지("미확인"/업로드 후 "확인 대기")를, 확인 완료면 "확인됨" 배지를 보여준다.
- 관리자: `AdminBookingsPanel`의 예약자 목록 각 행에 결제확인 상태 배지, 이미지 보기(업로드된 경우), 대리 업로드, 확인/확인 취소 버튼을 추가한다.
- **`CONFIRMED` 상태 예약에만 결제확인 UI(상태 배지·금액·업로드/대리 업로드 버튼·확인 버튼)를 표시한다.** `WAITING`(아직 확정되지 않아 입금 대상이 아님)과 `CANCELLED`(대상에서 제외) 둘 다 결제확인 열/셀을 비워둔다.

### 26.7 입금 금액 표시

결제 확인 대상 여부(26.2)를 판정하는 것과 별개로, 실제로 얼마를 입금해야 하는지 회원과 관리자에게 보여준다. 새로운 예외 규칙이 아니라 **기존 `paymentConfirmationRequired` 판정 결과에 고정 금액을 매핑**하는 것뿐이다 — 판정 로직(26.2)은 그대로 두고 표시 값만 추가한다.

**금액 규칙 (고정 상수, 관리자가 변경하는 UI는 이번 범위에 없음 — YAGNI)**
- `paymentConfirmationRequired === false`(면제): $0 — 표시하지 않는다.
- `paymentConfirmationRequired === true` && `memberType === CASUAL`: **$16**
- `paymentConfirmationRequired === true` && `memberType === ANNUAL`(월 멤버 미등록 순수 연 멤버, 또는 월 멤버이지만 본인 등록 요일이 아닌 날 참여 포함): **$13**
- 통화 표시 형식은 `$16`처럼 정수 달러 앞에 `$`만 붙인다(소수점/천단위 구분자 불필요 — 금액이 항상 정수 상수이므로 `Intl.NumberFormat` 같은 별도 포매팅 없이 `` `$${amount}` `` 템플릿으로 충분하다).

**적용 범위**: 판정 로직 자체(26.2)는 상태와 무관하게 계산되지만, 화면에 노출되는 것은 26.6에 따라 **`CONFIRMED` 상태 예약뿐**이다 — `WAITING`은 결제확인 UI 전체(배지·금액·버튼)가 보이지 않으므로 금액도 함께 보이지 않는다.

**표시 위치 3곳**
1. **공개 "내 예약 조회/취소" 화면(`CancelLookup`)**: `CONFIRMED` 상태 예약의 "결제확인" 열, 상태 배지 바로 아래에 `paymentAmountDue > 0`일 때만 금액을 보여준다(예: "입금 금액 $16"). 면제 배지에는 추가하지 않는다(이미 "면제"로 충분).
2. **관리자 예약자 목록(`AdminBookingsPanel`)**: `CONFIRMED` 상태 예약의 결제확인 셀에서 상태 배지 바로 아래, "이미지 보기"/"대리 업로드"/"결제 확인" 버튼 행보다 위에 금액 텍스트를 보여준다(예: "입금 금액 $16"). 증빙 이미지가 아직 없어 "이미지 보기" 버튼이 없는 상태(미업로드)에도 항상 보이게 한다 — 관리자가 얼마를 받아야 하는지 미리 아는 것이 핵심 목적이므로 버튼 유무에 종속시키지 않는다.
3. **관리자 예약일 상세 페이지(`app/admin/(protected)/booking-days/[id]/page.tsx`)**: "기본 정보" 카드에 "총 입금 예정 금액" 항목을 추가한다. **`CONFIRMED` 상태 예약만 합산**하며(`WAITING`/`CANCELLED` 제외), 이미 결제 확인된 건과 아직 미확인인 건을 구분하지 않고 "이 예약일에 총 얼마가 걷혀야 하는지"를 하나의 합계로 보여준다.

**데이터 흐름**: 금액은 클라이언트에서 계산하지 않는다. 서버(`lookupBookingsByPhone`/`listBookingsForAdmin`)가 이미 계산해둔 `paymentConfirmationRequired`와 `memberType`을 바탕으로 각 예약 DTO에 `paymentAmountDue`(숫자, USD)를 함께 내려주고, 화면은 그 값을 그대로 표시/합산만 한다(19번 `getPaymentAmountDue` 참고). 새 DB 컬럼은 필요 없다(파생 값, 요청 시점 계산 원칙 유지).

## 27. 참여자 영구 식별 코드(QR) 및 CSV 내보내기 (decisions.md D-33~D-35)

### 27.1 목적

이 시스템과는 완전히 별개인, 네트워크 연결이 없는 오프라인 "게임 로테이션 관리 프로그램"이 회원을 식별할 수 있도록, 예약을 신청한 사람 각자에게 영구적인 랜덤 코드를 발급하고 QR 이미지로 내려받을 수 있게 한다. 관리자가 "코드-이름-전화번호" 매핑 목록을 CSV로 내려받아 그 오프라인 프로그램에 별도로 전달하면, 현장에서 QR(코드만 담김)을 스캔했을 때 그 매핑표로 신원을 조회하는 방식이다. 예약 건별 QR 체크인(입장/퇴장, 별도 미병합 브랜치 `feature/member-check-in-out`)과는 목적·데이터 모델이 완전히 다른 별개 기능이다 — 그 기능은 예약(`Booking`) 1건당 QR 1개(`bkg:{bookingId}`)였고, 이번 기능은 "사람" 1명당 영구 코드 1개다.

### 27.2 대상 범위 (확정)

예약을 신청한 **모든 사람**이 대상이다. 연 멤버(`ANNUAL`)/캐주얼(`CASUAL`) 구분이나 연 멤버의 활성/비활성 여부와 무관하다 — 회비를 내는 정회원뿐 아니라 그날 참여하는 모든 사람을 오프라인 프로그램이 식별해야 하기 때문이다(decisions.md D-33). `AnnualMember`에 종속된 코드가 아니다.

### 27.3 코드 발급/재사용 규칙

- 식별 키는 이 시스템이 이미 예약 중복 판정(18번)·연 멤버 판정(4번)에 쓰는 것과 동일한 `normalizedName + phoneHash` 조합이다.
- 예약 생성(`createBooking`/`adminCreateBooking`/`applyMonthlyMembersToBookingDay`) 시점에, source(`USER`/`ADMIN`/`MONTHLY_MEMBER_AUTO`)와 무관하게 이 신원의 코드가 이미 있으면 재사용하고, 없으면 새로 발급한다(19번 `ensureParticipantCode`/`ensureParticipantCodesBatch` 참고). 예약 상태(`CONFIRMED`/`WAITING`)와도 무관하게 발급된다.
- 같은 사람이 여러 번 예약해도 항상 같은 코드를 받는다(재발급이 아니라 재사용, "영구 코드" 원칙).
- 코드는 정보를 담지 않는 순수 랜덤 문자열(12자)이며, 이름/전화번호 등 어떤 개인정보도 코드 자체에서 유추할 수 없다.
- 이 기능 도입 이전에 이미 존재하던 `Booking`/`AnnualMember` 데이터에도 코드를 소급 발급해야 한다(백필 스크립트, architecture.md 참고) — 그렇지 않으면 매칭 프로그램이 기존 참여자를 식별할 수 없다.

### 27.4 QR 표시/저장

- QR에는 `code` 값만 인코딩한다(이름/전화번호 등 어떤 정보도 담지 않음 — 확정 요구사항).
- "QR 저장하기" 버튼은 두 공개 화면에 노출한다.
  1. 예약 신청 완료 화면(`BookingForm`) — 방금 신청한 예약의 `participantCode`로 즉시 QR을 만들어 다운로드할 수 있다.
  2. "내 예약 조회/취소" 화면(`CancelLookup`) — 전화번호로 조회된 각 예약 건에도 동일하게 노출해, QR을 분실했거나 처음 발급받는 시점(백필 대상자)에도 언제든 다시 받을 수 있게 한다.
- 두 화면 모두 다국어(D-18) 적용 대상이므로 버튼 텍스트는 `lib/i18n/dictionary.ts`에 ko/en으로 추가한다.
- 관리자가 대신 등록하는 예약(`AdminBookingsPanel`, `adminCreateBooking`)에서도 코드는 동일하게 발급/재사용되지만, 관리자 화면에 QR 버튼을 노출하지는 않는다(이번 범위 밖, decisions.md D-33 — 관리자는 CSV로 충분).
- QR 이미지 생성은 클라이언트에서 신규 의존성 `qrcode`(decisions.md D-35)로 처리한다. 별도 서버 API 호출 없이, 이미 응답으로 받은 `code` 문자열을 그 자리에서 이미지로 변환해 다운로드시킨다.

### 27.5 CSV 내보내기 (관리자 전용, decisions.md D-34)

관리자 화면(`/admin/participant-codes`, 신규)은 발급된 참여자 코드 목록(코드/이름/전화번호)을 표로 보여주고, 각 행에 "내보내기 제외" 토글과 "삭제" 버튼, 화면 상단에 최근 내보내기 이력, "CSV 다운로드" 버튼을 제공한다. 27.5.2(제외 설정)·27.5.4(삭제) 때문에 이 화면은 순수 조회 전용이 아니지만, 그 외의 등록/수정 같은 일반적인 CRUD는 여전히 두지 않는다(YAGNI) — `ParticipantCode`는 예약 생성 시 시스템이 자동으로만 채우는 파생 데이터이고, 관리자가 직접 손댈 수 있는 건 "내보내기에서 뺄지"와 "아예 없앨지" 두 가지뿐이다.

**27.5.1 CSV 생성 규칙**
- "CSV 다운로드" 버튼(`GET /api/admin/participant-codes/export`)을 누르면 그 시점 기준으로 CSV를 생성해 내려준다.
- 컬럼: `코드, 이름, 전화번호` 3개뿐. 아래 27.5.2의 제외 설정 외에는 어떤 필터(활성/비활성, ANNUAL/CASUAL 등)도 적용하지 않는다(27.2와 동일한 전체 대상 원칙).
- 전화번호는 관리자 열람 목적으로 그 자리에서 복호화해 평문으로 내보낸다(기존 연 멤버/예약자 목록 조회와 동일한 패턴, 17번 "전화번호 저장 방식" 참고).
- 파일은 UTF-8(BOM 포함, 한글 엑셀 호환)로 인코딩하고, 파일명에 다운로드 시점 날짜(Pacific/Auckland 기준)를 포함한다.

**27.5.2 내보내기 제외 설정 (개정, opt-out 방식)**
- 기본은 전원 포함이며, 관리자가 화면에서 특정 인원을 골라 CSV에서 제외할 수 있다(opt-in이 아니라 opt-out — 제외하고 싶은 인원만 개별적으로 표시하는 방식).
- `ParticipantCode.excludedFromExport`(boolean, 기본 `false`)로 저장한다. 관리자가 각 행의 토글을 켜면 `true`로 저장되고, 그 시점부터 다시 토글을 끄기 전까지 **모든 후속 CSV 내보내기에서 계속 제외**된다 — CSV를 받을 때마다 매번 다시 선택하는 일회성 옵션이 아니라 영구 설정이다(오프라인 매칭 프로그램에 주기적으로 재내보내기할 상황을 가정).
- 관리자 화면의 참여자 목록에는 제외 설정된 행도 계속 표시된다(배지 등으로 "내보내기 제외" 상태를 표시). 그래야 관리자가 나중에 토글을 다시 켤 수 있다 — `listParticipantCodesForExport`(CSV용, 제외 대상 필터링)와 `listParticipantCodesForAdmin`(화면용, 전체 표시)를 별도 함수로 분리하는 이유다(19번 참고).
- 토글 변경은 `PATCH /api/admin/participant-codes/[id]`(body: `{ excludedFromExport: boolean }`)로 즉시 저장된다(이 프로젝트의 기존 PATCH 패턴 — 연 멤버 활성/비활성 토글 등 — 과 일관).

**27.5.3 내보내기 이력 (신규)**
- CSV를 실제로 생성해 응답한 시점마다(즉 `GET /api/admin/participant-codes/export`가 정상 처리될 때마다) 이력을 한 건 기록한다 — 다운로드 버튼을 누르지 않은 조회/화면 방문은 기록하지 않는다.
- 기록 항목: 내보낸 시각(Pacific/Auckland 기준 표시), 그 시점에 내보낸 인원 수(제외 설정 반영 후 실제 CSV에 담긴 행 수). "누가" 내려받았는지는 기록하지 않는다 — 관리자는 공유 비밀번호를 쓰는 단일 계정 체제라 개인 식별이 의미가 없다(2번 "관리자" 정의 참고).
- 관리자 화면(`/admin/participant-codes`)에 최근 내보내기 이력을 보여준다(예: "최근 내보내기: 2026-08-15 14:32 (312명)"). 여러 건을 목록으로 보여줄지 최신 1건만 보여줄지는 화면 레이아웃에 맞게 구현하되, 최소한 "가장 최근 1건"은 항상 확인할 수 있어야 한다.
- 이력은 삭제/정리 기능 없이 계속 누적한다(YAGNI — 발생 빈도가 낮아 저장량 문제가 되지 않음, D-32의 결제 증빙 이미지처럼 용량이 큰 데이터가 아니다).

**27.5.4 삭제 (신규)**
- 예약 폼이 지인 대리 예약(본인 번호로 지인 이름을 등록)을 허용하는 구조라, 잘못 등록되었거나 다시 쓰이지 않을 신원이 코드를 하나 차지하고 있을 수 있다. "제외" 토글은 CSV에서만 빼줄 뿐 행 자체는 남기 때문에, 이런 경우를 위해 행을 완전히 없애는 삭제 기능을 별도로 둔다.
- `DELETE /api/admin/participant-codes/[id]`로 즉시 삭제되며 되돌릴 수 없다(확인 다이얼로그로 실수 방지). 삭제 후 같은 `normalizedName+phoneHash` 조합으로 다시 예약이 들어오면 새 코드가 자동 발급된다 — 27.3번의 발급 규칙이 그대로 적용될 뿐, 삭제 자체가 별도 상태를 남기지 않는다.
- 같은 사람이 매번 다른 대리인 번호로 등록되어 코드가 여러 개로 쪼개지는 문제(신원 병합)는 이 기능의 범위 밖이다 — 삭제는 "이 행을 없앤다"이지 "여러 행을 하나로 합친다"가 아니다. 실제로 자주 발생하면 별도 기능으로 다시 검토한다(YAGNI).

### 27.6 예약 신청 폼 입력 UX 개선

이번 기능과 별개로 함께 요청된 개선사항이며, 데이터 정합성 문제가 아니라 순수 UI 개선이다(전화번호는 이미 저장 전 항상 숫자만 남기도록 정규화되고 있었음, decisions.md D-06 정규화 규칙 참고 — 기존 데이터에 대한 별도 재정규화 마이그레이션은 필요 없다).
- 예약 신청 폼(`BookingForm`)의 전화번호 입력칸에 저장 형식 안내를 `placeholder="0212345678"`로 표시한다.
- 이름 입력칸에 `autoComplete="name"`, 전화번호 입력칸에 `autoComplete="tel"`을 지정해 브라우저 자동완성을 지원한다.

**마지막 입력값 자동 채우기 (신규)**
- 예약 신청 폼(`BookingForm`)과 예약 조회/취소 폼(`CancelLookup`)은 마지막으로 입력했던 이름/전화번호를 브라우저에 저장해뒀다가 다음 방문 시 자동으로 채워준다(서버 저장 아님, 순수 클라이언트 편의 기능 — `lib/localBookingIdentity.ts`, `localStorage`).
- 두 폼이 값을 공유한다: `BookingForm`은 이름+전화번호를 모두 저장/복원하고, `CancelLookup`은 전화번호만 저장/복원한다(조회 폼에는 이름 입력칸이 없음). 예를 들어 예약 신청 후 조회 화면에 방문하면 방금 입력한 전화번호가 이미 채워져 있다.
- SSR과의 하이드레이션 불일치를 피하기 위해 초기 렌더는 항상 빈 값이며, 마운트 이후에만 저장된 값으로 채운다(따라서 값이 채워지기까지 짧은 지연이 있을 수 있다).
- `BookingForm`은 예약 신청 성공 시에만 저장한다(제출 후 입력칸 자체는 계속 비워, 한 자리에서 여러 명을 연달아 등록하는 기존 흐름은 그대로 유지). `CancelLookup`은 조회 성공 시에만 저장한다.
