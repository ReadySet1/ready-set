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
  /** Called once the confirmation is stored. `url` is the signature image URL
   *  when one was drawn, or null for a name-only confirmation. */
  onUploadComplete: (url: string | null) => void;
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
 * In-app pickup confirmation for the vendor pickup step. The NAME of the person
 * who handed over the order is required (2026-07-09 policy); the signature pad
 * is optional. Posts both to the orders signature endpoint, which records the
 * confirmation the PICKED_UP gate checks.
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
  const [receivedBy, setReceivedBy] = useState("");
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
    const name = receivedBy.trim();
    if (!name) {
      setError("Please enter who handed over the order.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("receivedBy", name);

      // The signature is optional — attach it only when the pad has ink.
      const pad = padRef.current;
      if (pad && !pad.isEmpty()) {
        const blob = dataURLToBlob(pad.toDataURL("image/png"));
        const file = new File([blob], "pickup-signature.png", {
          type: "image/png",
        });
        formData.append("file", file, file.name);
      }

      const endpoint =
        uploadEndpoint ??
        `/api/orders/${encodeURIComponent(orderNumber)}/signature`;
      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      const result = await res.json();
      toast.success("Pickup confirmed");
      onUploadComplete(result.url ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [orderNumber, uploadEndpoint, onUploadComplete, receivedBy]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-[13.5px] font-semibold text-driver-muted">
        Enter the name of the person who handed over the order. Signature is
        optional.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-semibold text-driver-muted">
          Received / confirmed by
        </span>
        <input
          type="text"
          value={receivedBy}
          onChange={(e) => {
            setReceivedBy(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Name of restaurant staff"
          maxLength={255}
          autoComplete="off"
          disabled={uploading}
          className="w-full rounded-2xl border-[1.5px] border-driver-border bg-driver-surface-alt px-4 py-3 text-[15px] font-semibold text-driver-text placeholder:text-driver-subtle focus:outline-none focus:ring-2 focus:ring-driver-brand disabled:opacity-50"
          aria-label="Received / confirmed by"
        />
      </label>

      <div className="relative overflow-hidden rounded-2xl border-[1.5px] border-driver-border bg-driver-surface-alt">
        <canvas
          ref={canvasRef}
          className="h-48 w-full touch-none"
          aria-label="Signature pad (optional)"
        />
        {!hasInk ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-driver-subtle">
            Sign here (optional)
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
          disabled={uploading || !receivedBy.trim()}
          onClick={handleConfirm}
          className="flex-1"
        >
          {!uploading ? <Check className="h-4 w-4" strokeWidth={2.6} /> : null}
          Confirm pickup
        </DriverButton>
      </div>

      <button
        type="button"
        onClick={onCancel}
        disabled={uploading}
        className="text-[12.5px] font-semibold text-driver-muted disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
