"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { AlertCircle, Check, Eraser } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { DriverButton } from "./ui/DriverButton";

interface SignatureCaptureProps {
  orderNumber: string;
  /** Endpoint override (defaults to /api/orders/[order_number]/signature). */
  uploadEndpoint?: string;
  /** Called with the stored signature URL once capture + upload succeeds. */
  onUploadComplete: (url: string) => void;
  onCancel: () => void;
  className?: string;
}

/** Decode a `data:` URL into a Blob (no fetch — works offline / in jsdom). */
function dataURLToBlob(dataURL: string): Blob {
  const [head, body] = dataURL.split(",");
  const mime = head?.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(body ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * In-app signature pad for the vendor pickup step. Captures a manual signature
 * from the restaurant staff (not DocuSign), exports a PNG, and uploads it to the
 * orders signature endpoint. Mandatory before a driver can mark a pickup done.
 */
export function SignatureCapture({
  orderNumber,
  uploadEndpoint,
  onUploadComplete,
  onCancel,
  className,
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialise the pad and keep the canvas crisp on high-DPI screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePad(canvas, {
      penColor: "#15202e",
      backgroundColor: "rgba(0,0,0,0)",
      minWidth: 0.8,
      maxWidth: 2.4,
    });
    padRef.current = pad;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear(); // resizing wipes the canvas — reset pad state too
      setHasInk(false);
    };
    resize();

    const onEnd = () => setHasInk(!pad.isEmpty());
    pad.addEventListener("endStroke", onEnd);
    window.addEventListener("resize", resize);

    return () => {
      pad.removeEventListener("endStroke", onEnd);
      window.removeEventListener("resize", resize);
      pad.off();
      padRef.current = null;
    };
  }, []);

  const handleClear = useCallback(() => {
    padRef.current?.clear();
    setHasInk(false);
    setError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setError("Please capture a signature first.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const blob = dataURLToBlob(pad.toDataURL("image/png"));
      const file = new File([blob], "pickup-signature.png", {
        type: "image/png",
      });
      const formData = new FormData();
      formData.append("file", file, file.name);

      const endpoint =
        uploadEndpoint ??
        `/api/orders/${encodeURIComponent(orderNumber)}/signature`;
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      const result = await res.json();
      toast.success("Signature captured");
      onUploadComplete(result.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [orderNumber, uploadEndpoint, onUploadComplete]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-[13.5px] font-semibold text-driver-muted">
        Ask the restaurant staff to sign below to confirm pickup.
      </p>

      <div className="relative overflow-hidden rounded-2xl border-[1.5px] border-driver-border bg-driver-surface-alt">
        <canvas
          ref={canvasRef}
          className="h-48 w-full touch-none"
          aria-label="Signature pad"
        />
        {!hasInk ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-driver-subtle">
            Sign here
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-driver-error">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <DriverButton
          variant="outline"
          onClick={handleClear}
          disabled={uploading || !hasInk}
        >
          <Eraser className="h-4 w-4" strokeWidth={2.4} />
          Clear
        </DriverButton>
        <DriverButton
          variant="brand"
          full
          loading={uploading}
          disabled={uploading || !hasInk}
          onClick={handleConfirm}
          className="flex-1"
        >
          {!uploading ? <Check className="h-4 w-4" strokeWidth={2.6} /> : null}
          Confirm signature
        </DriverButton>
      </div>

      <button
        type="button"
        onClick={onCancel}
        disabled={uploading}
        className="text-[12.5px] font-bold text-driver-muted disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
