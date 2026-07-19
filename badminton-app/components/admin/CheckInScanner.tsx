"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { decodeBookingQrValue } from "@/lib/checkInQr";

const SCAN_COOLDOWN_MS = 2000;

/**
 * 노트북 카메라로 QR을 스캔해 입장/퇴장을 처리한다(decisions.md D-27).
 * getUserMedia로 카메라 스트림을 열고, requestAnimationFrame 루프에서 매 프레임을 캔버스에
 * 그려 jsQR로 디코딩한다. 스캔에 성공하면 짧은 쿨다운을 두어, 같은 QR이 화면에 계속 보여도
 * 중복 처리되지 않게 한다. QR 값은 `bkg:{bookingId}` 형식만 처리하고, 그 외(관계없는 QR)는
 * 무시한다.
 */
export function CheckInScanner({ bookingDayId }: { bookingDayId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cooldownUntilRef = useRef(0);
  const processingRef = useRef(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleDecoded = useCallback(
    async (bookingId: string) => {
      processingRef.current = true;
      try {
        const res = await fetch(`/api/admin/booking-days/${bookingDayId}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId }),
        });
        const json = await res.json();
        if (!res.ok) {
          setStatus({ type: "error", message: json?.error?.message ?? "처리에 실패했습니다." });
          return;
        }
        const name: string = json.data?.booking?.name ?? "회원";
        const action: string = json.data?.action;
        setStatus({
          type: "success",
          message:
            action === "CHECKED_IN" ? `${name}님 입장 처리되었습니다.` : `${name}님 퇴장 처리되었습니다.`,
        });
        router.refresh();
      } catch {
        setStatus({ type: "error", message: "네트워크 오류가 발생했습니다." });
      } finally {
        cooldownUntilRef.current = Date.now() + SCAN_COOLDOWN_MS;
        processingRef.current = false;
      }
    },
    [bookingDayId, router]
  );

  useEffect(() => {
    let cancelled = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          if (!processingRef.current && Date.now() >= cooldownUntilRef.current) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              const bookingId = decodeBookingQrValue(code.data);
              if (bookingId) {
                handleDecoded(bookingId);
              }
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        setCameraError("카메라에 접근할 수 없습니다. 브라우저의 카메라 권한을 확인해주세요.");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [handleDecoded]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-md border bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {cameraError && (
        <p role="alert" aria-live="assertive" className="text-sm text-destructive">
          {cameraError}
        </p>
      )}
      {status && (
        <p
          role={status.type === "error" ? "alert" : undefined}
          aria-live={status.type === "error" ? "assertive" : "polite"}
          className={status.type === "error" ? "text-sm text-destructive" : "text-sm font-medium text-primary"}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
