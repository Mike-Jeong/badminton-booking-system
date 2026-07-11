/**
 * Pacific/Auckland(뉴질랜드) IANA 타임존 기준 날짜/요일 계산 유틸.
 * requirements.md 21번(타임존), decisions.md D-05 확정사항: 고정 UTC 오프셋이 아닌
 * IANA 타임존 이름 기반으로 계산해 서머타임(NZDT/NZST) 전환을 자동으로 반영한다.
 *
 * 외부 날짜 라이브러리 없이 Intl API만으로 구현한다.
 */

export const AUCKLAND_TIME_ZONE = "Pacific/Auckland";

interface DateParts {
  year: number;
  month: number; // 1~12
  day: number;
}

function getDatePartsInTimeZone(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

/**
 * 주어진 시각(instant)을 IANA 타임존 기준으로 형식화했을 때의 UTC와의 분(minute) 차이.
 * local = utc + offsetMinutes
 */
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return (asUTC - date.getTime()) / 60000;
}

function isValidDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * "YYYY-MM-DD" 형식의 날짜(Pacific/Auckland 기준 캘린더 날짜)를 받아,
 * 그 날짜의 Pacific/Auckland 자정(00:00)에 해당하는 UTC 시각(Date)을 반환한다.
 * DB(BookingDay.date)에 저장할 때 사용한다.
 */
export function dateOnlyToUtcMidnight(dateOnly: string): Date {
  if (!isValidDateOnly(dateOnly)) {
    throw new Error(`잘못된 날짜 형식입니다: ${dateOnly} (YYYY-MM-DD 형식이어야 합니다)`);
  }
  const [year, month, day] = dateOnly.split("-").map(Number);

  // 1차 추정: 이 날짜를 그대로 UTC 자정으로 가정
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, AUCKLAND_TIME_ZONE);
  // local(Auckland) = UTC + offset  =>  UTC = local - offset
  // utcGuess를 "Auckland 기준 y-m-d 00:00 시점의 로컬 시각"으로 보정한다.
  return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
}

/**
 * 주어진 UTC 시각(Date)을 Pacific/Auckland 기준 "YYYY-MM-DD" 문자열로 변환한다.
 */
export function formatDateOnlyInTimeZone(date: Date): string {
  const { year, month, day } = getDatePartsInTimeZone(date, AUCKLAND_TIME_ZONE);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 주어진 시각(Date)의 Pacific/Auckland 기준 요일을 반환한다.
 * 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토 (JS Date.getDay() 규칙과 동일)
 */
export function getDayOfWeekInTimeZone(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: AUCKLAND_TIME_ZONE,
    weekday: "short",
  });
  const weekday = formatter.format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = map[weekday];
  if (dayOfWeek === undefined) {
    throw new Error(`요일 계산에 실패했습니다: ${weekday}`);
  }
  return dayOfWeek;
}

/**
 * "YYYY-MM-DD" 형식의 날짜(Pacific/Auckland 기준 캘린더 날짜)로부터 바로 요일을 계산한다.
 * BookingDay.dayOfWeek는 이 함수의 결과로 서버가 자동 계산하며, 사용자가 직접 입력하지 않는다.
 */
export function getDayOfWeekForDateOnly(dateOnly: string): number {
  const utcMidnight = dateOnlyToUtcMidnight(dateOnly);
  return getDayOfWeekInTimeZone(utcMidnight);
}

/**
 * Pacific/Auckland 기준 "오늘" 날짜 정보를 반환한다. 대시보드 등에서 사용.
 */
export function getTodayInTimeZone(): DateParts {
  return getDatePartsInTimeZone(new Date(), AUCKLAND_TIME_ZONE);
}

export function getTodayDateOnlyInTimeZone(): string {
  const { year, month, day } = getTodayInTimeZone();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * "YYYY-MM-DD" 날짜에 days(음수 가능)를 더한 "YYYY-MM-DD"를 반환한다. 순수 캘린더 날짜
 * 산술이라 타임존 변환이 필요 없다(대시보드 기본 조회 범위 계산 등에 사용).
 */
export function addDaysToDateOnly(dateOnly: string, days: number): string {
  if (!isValidDateOnly(dateOnly)) {
    throw new Error(`잘못된 날짜 형식입니다: ${dateOnly} (YYYY-MM-DD 형식이어야 합니다)`);
  }
  const [year, month, day] = dateOnly.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(
    base.getUTCDate()
  ).padStart(2, "0")}`;
}

const DAY_OF_WEEK_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_OF_WEEK_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** dayOfWeek(0=일~6=토) 정수를 한글 요일 라벨로 변환한다. 화면 표시 전용(관리자 화면용). */
export function getDayOfWeekLabelKo(dayOfWeek: number): string {
  return DAY_OF_WEEK_LABELS_KO[dayOfWeek] ?? "?";
}

/** dayOfWeek(0=일~6=토) 정수를 locale에 맞는 요일 라벨로 변환한다(공개 화면 다국어용, decisions.md D-18). */
export function getDayOfWeekLabel(dayOfWeek: number, locale: "ko" | "en"): string {
  return locale === "ko" ? getDayOfWeekLabelKo(dayOfWeek) : (DAY_OF_WEEK_LABELS_EN[dayOfWeek] ?? "?");
}
