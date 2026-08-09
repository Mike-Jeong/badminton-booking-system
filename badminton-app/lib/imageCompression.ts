/**
 * 결제 증빙 업로드 전 클라이언트 사이드 이미지 압축(decisions.md D-32).
 * base64-in-Turso 방식을 채택한 대신, DB 용량 증가 속도를 낮추기 위해 업로드 전 리사이즈/
 * 재인코딩을 구현 조건으로 못박았다. 브라우저 네이티브 Image/HTMLCanvasElement/canvas.toBlob
 * API만 사용하며 새 npm 의존성을 추가하지 않는다. 클라이언트 컴포넌트에서만 호출한다
 * (Image/HTMLCanvasElement는 브라우저 전용 API라 서버 컴포넌트/라우트 핸들러에서는 동작하지 않음).
 */

const DEFAULT_MAX_WIDTH = 1024; // 가로 최대 1024px
const DEFAULT_QUALITY = 0.7; // JPEG quality ~0.7

export interface CompressImageOptions {
  maxWidth?: number;
  quality?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = src;
  });
}

/**
 * 이미지 파일을 가로 최대 maxWidth로 리사이즈하고 JPEG(quality)로 재인코딩한 새 File을
 * 반환한다. Canvas/이미지 디코딩이 실패하는 극히 예외적인 환경에서는 원본 파일을 그대로
 * 반환한다(업로드 자체가 막히지 않도록 하는 방어적 폴백 — 서버 측 2MB 상한이 최종 방어선).
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const quality = options.quality ?? DEFAULT_QUALITY;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });
    if (!blob) {
      return file;
    }

    const compressedName = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], compressedName, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
