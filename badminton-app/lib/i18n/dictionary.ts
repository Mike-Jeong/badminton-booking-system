/**
 * 공개(일반 사용자) 화면 전용 한/영 다국어 사전(decisions.md D-18).
 * 관리자 화면은 이 사전을 사용하지 않고 한글을 그대로 유지한다.
 */

export type Locale = "ko" | "en";

export const dictionary = {
  ko: {
    nav: {
      siteTitle: "배드민턴 예약",
      lookupLink: "내 예약 조회/취소",
    },
    list: {
      heading: "예약 가능한 날짜",
      subheading: "날짜를 선택해 이름과 전화번호로 예약을 신청하세요.",
      empty: "현재 공개된 예약일이 없습니다.",
      time: "시간",
      location: "장소",
      duty: "듀티",
      slots: "슬롯",
      ended: "종료됨",
    },
    detail: {
      back: "← 예약 가능한 날짜",
      basicInfo: "기본 정보",
      time: "시간",
      location: "장소",
      dutyPerson: "듀티 담당자",
      slots: "슬롯",
      confirmedWaiting: "확정/대기",
      rosterTitle: (count: number) => `예약자 명단 (${count})`,
      name: "이름",
      status: "상태",
      emptyRoster: "아직 예약자가 없습니다.",
      confirmed: "확정",
      waiting: "대기",
      ended: "종료됨",
    },
    form: {
      title: "예약 신청",
      name: "이름",
      phone: "전화번호",
      resultConfirmed: "예약이 확정되었습니다.",
      resultWaiting: "슬롯이 가득 차 대기 명단에 등록되었습니다.",
      fallbackError: "예약 신청에 실패했습니다.",
      networkError: "네트워크 오류가 발생했습니다.",
      submitting: "신청 중...",
      submit: "예약 신청",
      endedMessage: "이 예약일은 이미 종료되어 더 이상 신청할 수 없습니다.",
    },
    lookup: {
      heading: "내 예약 조회/취소",
      subheading: "전화번호를 입력하면 등록된 예약 목록을 확인하고 취소할 수 있습니다.",
      cardTitle: "내 예약 조회",
      phone: "전화번호",
      searching: "조회 중...",
      search: "조회",
      fallbackError: "조회에 실패했습니다.",
      networkError: "네트워크 오류가 발생했습니다.",
      resultTitle: (count: number) => `조회 결과 (${count})`,
      date: "날짜",
      name: "이름",
      status: "상태",
      empty: "이 전화번호로 등록된 예약이 없습니다.",
      confirmDialog: "이 예약을 취소하시겠습니까?",
      cancelling: "취소 중...",
      cancel: "취소",
      cancelFallbackError: "취소에 실패했습니다.",
      statusLabel: { CONFIRMED: "확정", WAITING: "대기", CANCELLED: "취소됨" },
      endedNote: "종료된 예약일 (취소 불가)",
    },
  },
  en: {
    nav: {
      siteTitle: "Badminton Booking",
      lookupLink: "My Bookings",
    },
    list: {
      heading: "Available Booking Days",
      subheading: "Select a date and apply with your name and phone number.",
      empty: "No booking days are currently open.",
      time: "Time",
      location: "Location",
      duty: "Duty",
      slots: "Slots",
      ended: "Ended",
    },
    detail: {
      back: "← Available Booking Days",
      basicInfo: "Details",
      time: "Time",
      location: "Location",
      dutyPerson: "Duty Person",
      slots: "Slots",
      confirmedWaiting: "Confirmed/Waiting",
      rosterTitle: (count: number) => `Registered (${count})`,
      name: "Name",
      status: "Status",
      emptyRoster: "No one has registered yet.",
      confirmed: "Confirmed",
      waiting: "Waiting",
      ended: "Ended",
    },
    form: {
      title: "Apply for Booking",
      name: "Name",
      phone: "Phone Number",
      resultConfirmed: "Your booking is confirmed.",
      resultWaiting: "Slots are full — you've been added to the waiting list.",
      fallbackError: "Failed to submit booking.",
      networkError: "A network error occurred.",
      submitting: "Submitting...",
      submit: "Apply",
      endedMessage: "This session has already ended and is no longer accepting applications.",
    },
    lookup: {
      heading: "My Bookings",
      subheading: "Enter your phone number to view and cancel your bookings.",
      cardTitle: "Look Up My Bookings",
      phone: "Phone Number",
      searching: "Searching...",
      search: "Search",
      fallbackError: "Failed to look up bookings.",
      networkError: "A network error occurred.",
      resultTitle: (count: number) => `Results (${count})`,
      date: "Date",
      name: "Name",
      status: "Status",
      empty: "No bookings found for this phone number.",
      confirmDialog: "Are you sure you want to cancel this booking?",
      cancelling: "Cancelling...",
      cancel: "Cancel",
      cancelFallbackError: "Failed to cancel booking.",
      statusLabel: { CONFIRMED: "Confirmed", WAITING: "Waiting", CANCELLED: "Cancelled" },
      endedNote: "Session ended (cannot cancel)",
    },
  },
} as const satisfies Record<Locale, unknown>;

export function formatSlotSummary(
  locale: Locale,
  slotMode: "SEPARATED" | "COMBINED",
  annualSlots: number,
  casualSlots: number,
  totalSlots: number
): string {
  if (slotMode === "SEPARATED") {
    return locale === "ko"
      ? `연 ${annualSlots} + 캐 ${casualSlots} = ${totalSlots}`
      : `Annual ${annualSlots} + Casual ${casualSlots} = ${totalSlots}`;
  }
  return locale === "ko" ? `${totalSlots}명` : `${totalSlots} slots`;
}

export function formatConfirmedWaiting(locale: Locale, confirmed: number, waiting: number): string {
  return locale === "ko"
    ? `${confirmed}명 확정 · ${waiting}명 대기`
    : `${confirmed} confirmed · ${waiting} waiting`;
}

/**
 * API가 돌려주는 한글 에러 메시지는 서버가 항상 한글로 생성한다(공개 API는 code도 함께
 * 내려주지만, 같은 code라도 상황별 메시지가 여러 개라 code만으로는 구분이 안 된다).
 * 알려진 메시지 문자열을 그대로 매핑하고, 매핑에 없는 메시지는 원문(한글)을 그대로 보여준다.
 */
const KNOWN_ERROR_MESSAGES: Record<string, string> = {
  "bookingDayId, name, phone이 필요합니다.": "bookingDayId, name, and phone are required.",
  "phone이 필요합니다.": "Phone number is required.",
  "이름을 입력해주세요.": "Please enter your name.",
  "전화번호를 입력해주세요.": "Please enter your phone number.",
  "예약일을 찾을 수 없습니다.": "Booking day not found.",
  "예약을 찾을 수 없습니다.": "Booking not found.",
  "이미 이 예약일에 신청된 예약이 있습니다.": "You have already applied for this booking day.",
  "전화번호가 일치하지 않아 취소할 수 없습니다.": "Cannot cancel — phone number does not match.",
  "이미 취소된 예약입니다.": "This booking has already been cancelled.",
  "이미 종료된 예약일에는 신청할 수 없습니다.": "This booking day has already ended — applications are closed.",
  "이미 종료된 예약일의 예약은 취소할 수 없습니다.": "This booking day has already ended — cancellations are closed.",
  "서버 오류가 발생했습니다.": "A server error occurred.",
};

export function translateApiErrorMessage(locale: Locale, message: string): string {
  if (locale === "ko") return message;
  return KNOWN_ERROR_MESSAGES[message] ?? message;
}
