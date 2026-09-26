/**
 * 카카오톡 인앱 브라우저(웹뷰) 감지 및 외부 브라우저 열기(decisions.md D-40).
 * 카톡 채팅방에서 링크를 바로 누르면 인앱 웹뷰가 열리는데, 이 환경에서 미디어 선택창으로 고른
 * 사진 업로드가 간헐적으로 실패한다(카카오 데브톡 공개 보고, 갤럭시/Android 13·14).
 */

export function isKakaoInAppBrowser(userAgent: string): boolean {
  return /KAKAOTALK/i.test(userAgent);
}

/**
 * 카카오톡 웹뷰에서 기기 기본 브라우저로 같은 URL을 여는 커스텀 스킴. 카카오 공식 문서에는
 * 없지만 안드로이드/iOS 양쪽에서 널리 쓰이는 방식이라, 공식 지원이 아닌 만큼 자동 리다이렉트는
 * 하지 않고 반드시 사용자가 버튼을 눌렀을 때(사용자 제스처)만 호출한다.
 */
export function openInExternalBrowser(url: string): void {
  window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}
