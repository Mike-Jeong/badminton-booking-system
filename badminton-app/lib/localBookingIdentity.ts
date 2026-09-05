/**
 * 예약 신청/조회 폼에서 마지막으로 입력한 이름·전화번호를 브라우저(localStorage)에 남겨,
 * 다음 방문 때 자동으로 채워준다. 서버에는 저장하지 않는 순수 편의 기능이라, 프라이빗 모드
 * 등으로 localStorage를 쓸 수 없어도 조용히 무시하고 빈 값으로 동작한다.
 */

const NAME_KEY = "badminton:lastName";
const PHONE_KEY = "badminton:lastPhone";

export interface SavedIdentity {
  name: string;
  phone: string;
}

export function loadSavedIdentity(): SavedIdentity {
  try {
    return {
      name: window.localStorage.getItem(NAME_KEY) ?? "",
      phone: window.localStorage.getItem(PHONE_KEY) ?? "",
    };
  } catch {
    return { name: "", phone: "" };
  }
}

/** name/phone 중 전달된 값만 갱신한다(예: 조회 폼은 phone만 저장, 기존 name은 유지). */
export function saveIdentity(identity: Partial<SavedIdentity>): void {
  try {
    if (identity.name !== undefined) window.localStorage.setItem(NAME_KEY, identity.name);
    if (identity.phone !== undefined) window.localStorage.setItem(PHONE_KEY, identity.phone);
  } catch {
    // 무시 — 캐싱은 편의 기능일 뿐 핵심 흐름에 영향을 주면 안 된다.
  }
}
