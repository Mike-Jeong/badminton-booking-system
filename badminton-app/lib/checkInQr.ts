/**
 * 예약별 체크인 QR 값 인코딩/디코딩(decisions.md D-27).
 * 접두어(bkg:)를 붙여, 카메라로 관계없는 QR(예: 다른 물건의 바코드)을 스캔했을 때
 * 곧바로 무시할 수 있게 한다. bookingId 자체는 이미 예측 불가능한 cuid라 별도 서명은 두지 않는다
 * — 스캔 처리 API는 관리자 인증이 필요하므로 QR 값만으로 할 수 있는 일이 없다.
 */

const QR_PREFIX = "bkg:";

export function encodeBookingQrValue(bookingId: string): string {
  return `${QR_PREFIX}${bookingId}`;
}

export function decodeBookingQrValue(value: string): string | null {
  if (!value.startsWith(QR_PREFIX)) {
    return null;
  }
  const bookingId = value.slice(QR_PREFIX.length).trim();
  return bookingId.length > 0 ? bookingId : null;
}
