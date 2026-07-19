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

클라이언트에서 `memberType`을 전달하지 않는다. 서버가 직접 계산한다.

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
- 회원 입장/퇴장(체크인) 처리 — QR 스캔 또는 수동 처리 (25번 참고)

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
  createdAt
  updatedAt
  cancelledAt
  checkedInAt       // 회원 입장 처리 시각 (nullable, decisions.md D-27)
  checkedOutAt      // 회원 퇴장 처리 시각 (nullable, checkedInAt 없이는 설정 불가, decisions.md D-27)
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

### applyMonthlyMembersToBookingDay
```ts
applyMonthlyMembersToBookingDay(bookingDayId)
```
- 예약일의 연도/월/요일 확인
- 해당 조건과 일치하는 활성 월 멤버 조회 (`MonthlyMember.isActive` AND `AnnualMember.isActive`)
- 중복 예약 확인
- 예약 자동 생성 (source = `MONTHLY_MEMBER_AUTO`)
- 슬롯이 있으면 `CONFIRMED`, 없으면 `WAITING`
- 결과로 생성 수, 스킵 수 반환

## 20. 동시성 처리

다음 작업은 반드시 DB Transaction 안에서 처리한다.
- 예약 생성
- 예약 취소
- 관리자 승인
- 슬롯 변경
- 월 멤버 자동 배정
- 대기자 자동 승격

동시 예약이 발생해도 예약 가능 인원을 초과하지 않도록 한다.

## 21. 기술 스택

**Frontend**
- Next.js
- React
- Tailwind CSS
- shadcn/ui
- `qrcode.react`(QR 코드 생성), `jsqr`(카메라 프레임 QR 디코딩) — 체크인 기능 전용, decisions.md D-27

**Backend**
- Next.js Route Handlers

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

## 25. 회원 입장/퇴장(체크인) 관리 (decisions.md D-27)

예약된 회원이 실제로 체육관에 도착했는지 확인하는 기능. 별도 출석 상태 enum 없이, `Booking`의 `checkedInAt`/`checkedOutAt` 두 타임스탬프 조합으로 상태를 표현한다: 미입장(둘 다 null) → 입장(`checkedInAt`만 설정) → 퇴장(둘 다 설정). `status === "CONFIRMED"`인 예약만 체크인 대상이며, 체크인 상태는 슬롯/대기 승격 로직에 영향을 주지 않는다.

**25.1 QR 스캔 처리 (예약일별 스캔 화면)**
- 공개 "내 예약 조회/취소" 화면에서 `CONFIRMED` 예약마다 "QR 코드 보기" 버튼을 눌러 그 예약 전용 QR 코드를 모달로 확인할 수 있다.
- 관리자는 예약일 상세 화면에서 "체크인 스캔 열기" 링크로 그 예약일 전용 스캔 화면(`/admin/booking-days/[id]/check-in`)에 진입해, 노트북 카메라로 회원의 QR을 스캔한다.
- 스캔된 예약이 그 스캔 화면의 예약일과 일치하지 않으면(다른 날짜의 QR을 스캔) 거부한다.
- 스캔 시 현재 상태에 따라 자동으로 판단한다: 미입장 → 입장 처리, 입장만 됨 → 퇴장 처리, 입장/퇴장 모두 됨 → 오류(관리자 화면에서 직접 수정 안내).
- 스캔 화면에는 그 예약일의 확정 예약자 실시간 명단(이름/전화번호/출석 상태)도 함께 표시된다.

**25.2 수동 처리 (관리자 화면)**
- 카메라를 쓸 수 없는 상황(회원이 QR을 못 보여줌, 카메라 문제 등)을 위해, 예약일 상세의 예약자 목록에서 관리자가 직접 입장/퇴장/초기화 버튼으로 처리할 수 있다.
- 초기화는 `checkedInAt`/`checkedOutAt`을 모두 null로 되돌리는 실수 정정용 기능이며, 실행 전 확인 대화상자를 거친다.
- 종료된 예약일(decisions.md D-23)이라도 관리자의 입장/퇴장/초기화 처리는 차단하지 않는다(관리자 액션은 사후 기록 정정이 가능해야 한다는 기존 원칙과 일관).
