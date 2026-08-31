"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { AlertCircle, Check, Eraser, Maximize2, Minimize2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { withBearerAuth } from "@/lib/auth/bearer-session";
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
  // Full-screen signing mode (field feedback: the inline pad is too small).
  const [fullscreen, setFullscreen] = useState(false);

  // Initialise the pad and keep the canvas crisp on high-DPI screens.
  //
  // Sizing is driven by a ResizeObserver (not a mount-time read + window
  // resize listener) because BOTH of those bit us in the field:
  //  - at mount the bottom sheet is still animating in, so offsetWidth can be
  //    0 (especially in the native WebView) → a 0×0 canvas that ignores touch;
  //  - the iOS keyboard (opened by the receiver-name input) fires window
  //    resize, and the old handler cleared the pad — wiping the signature.
  // The observer resizes only on real dimension changes and PRESERVES the ink
  // by replaying the stroke data after rescaling.
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

    let lastW = 0;
    let lastH = 0;
    const applySize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) return; // not laid out yet — wait for the observer
      if (w === lastW && h === lastH) return;
      const prevW = lastW;
      const prevH = lastH;
      lastW = w;
      lastH = h;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const strokes = pad.toData(); // preserve ink across the resize
      canvas.width = w * ratio; // resets the 2d transform
      canvas.height = h * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear();
      if (strokes.length > 0) {
        // toData() points are in CSS-pixel coordinates of the OLD canvas size;
        // replaying them verbatim onto a differently-sized canvas draws them
        // off-canvas (fullscreen → collapsed lost the whole signature in the
        // field). Rescale every point to the new dimensions before replaying.
        //
        // The scale factor must be UNIFORM — one `s` for both axes. The first
        // fix scaled x and y independently (x·w/prevW, y·h/prevH), which
        // squashed the fullscreen portrait signature ~8× vertically on
        // collapse — and handleConfirm snapshots the CURRENT canvas, so the
        // distorted PNG is what got persisted (2026-08-18 field failure).
        // s = min(...) guarantees the whole ink box fits the new canvas, and
        // centering the leftover space keeps it visible instead of pinned to
        // the top-left corner.
        const rescale =
          prevW > 0 && prevH > 0 && (prevW !== w || prevH !== h)
            ? (() => {
                const s = Math.min(w / prevW, h / prevH);
                const offsetX = (w - prevW * s) / 2;
                const offsetY = (h - prevH * s) / 2;
                return strokes.map((group) => ({
                  ...group,
                  points: group.points.map((p) => ({
                    ...p,
                    x: p.x * s + offsetX,
                    y: p.y * s + offsetY,
                  })),
                }));
              })()
            : strokes;
        pad.fromData(rescale);
      }
      setHasInk(!pad.isEmpty());
    };
    applySize();

    const observer = new ResizeObserver(() => applySize());
    observer.observe(canvas);

    const onEnd = () => setHasInk(!pad.isEmpty());
    pad.addEventListener("endStroke", onEnd);

    return () => {
      observer.disconnect();
      pad.removeEventListener("endStroke", onEnd);
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
      // Bearer token survives stale auth cookies (2026-08 field failure); no
      // manual Content-Type — the browser must set the multipart boundary.
      const res = await fetch(endpoint, {
        method: "POST",
        headers: await withBearerAuth(),
        body: formData,
      });
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

      <div
        className={cn(
          fullscreen
            ? "driver-theme fixed inset-0 z-[100] flex flex-col gap-3 bg-driver-surface p-4 pt-[max(env(safe-area-inset-top),1rem)]"
            : "contents",
        )}
      >
        {fullscreen ? (
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-driver-text">
              Sign here
            </span>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-driver-border px-3 py-1.5 text-[12.5px] font-semibold text-driver-muted"
              aria-label="Exit full screen"
            >
              <Minimize2 className="h-4 w-4" />
              Done
            </button>
          </div>
        ) : null}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border-[1.5px] border-driver-border bg-driver-surface-alt",
            fullscreen && "flex-1",
          )}
        >
          <canvas
            ref={canvasRef}
            className={cn("w-full touch-none", fullscreen ? "h-full" : "h-48")}
            aria-label="Signature pad (optional)"
          />
          {!hasInk ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-driver-subtle">
              Sign here (optional)
            </span>
          ) : null}
          {!fullscreen ? (
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="absolute right-2 top-2 rounded-xl border-[1.5px] border-driver-border bg-driver-surface p-2 text-driver-muted"
              aria-label="Sign in full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {fullscreen ? (
          <DriverButton
            variant="outline"
            onClick={handleClear}
            disabled={uploading || !hasInk}
          >
            <Eraser className="h-4 w-4" strokeWidth={2.4} />
            Clear
          </DriverButton>
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
