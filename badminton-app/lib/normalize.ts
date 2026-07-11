/**
 * 이름/전화번호 정규화 규칙 (requirements.md 7번, decisions.md D-06 확정)
 * - 이름: 앞뒤 공백만 제거(trim). 내부 공백/대소문자는 그대로 둔다.
 * - 전화번호: 숫자만 남긴다(하이픈, 공백, 괄호, 국가번호 기호(+) 등 숫자가 아닌 문자는 모두 제거).
 */

export function normalizeName(name: string): string {
  return name.trim();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
