"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import { AlertCircle, Check, Eraser, Maximize2, Minimize2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { withBearerAuth } from "@/lib/auth/bearer-session";
import { DriverButton } from "./ui/DriverButton";
import {
  computeView,
  fromView,
  growFrame,
  toView,
  type Frame,
  type Rotation,
  type StrokeGroup,
  type View,
} from "./signature-geometry";

/** `lock` is missing from some lib.dom versions and throws/rejects on iOS. */
type LockableOrientation = {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

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
  // Portrait viewport ⇒ the fullscreen pad is shown in landscape by rotating
  // its chrome 90° with CSS. The wrapper app may lock orientation, so we never
  // rely on the device rotating; if the viewport IS landscape (device rotated
  // or orientation.lock() succeeded) no CSS rotation is needed.
  const [portrait, setPortrait] = useState(false);
  const rotated = fullscreen && portrait;

  // Ink model (see signature-geometry.ts): strokes live in a canonical upright
  // base space; each layout is a view computed FROM the base, never chained
  // from the previous canvas size. Chaining (the pre-2026-09 code) re-fit the
  // whole previous canvas box on every hop — inline 340×192 → fullscreen
  // 340×600 → inline shrank the ink to ~32% while pen widths stayed full
  // size, and every keyboard show/hide shrank it again: the deformed "Bob"
  // from the 2026-09-22 test drive.
  const baseRef = useRef<{ frame: Frame | null; strokes: StrokeGroup[] }>({
    frame: null,
    strokes: [],
  });
  const viewRef = useRef<View | null>(null);
  // How many leading groups in pad.toData() are replays of baseRef — anything
  // after them was drawn in the current view and still has to be folded in.
  const replayedRef = useRef(0);
  const rotationRef = useRef<Rotation>(0);
  const applySizeRef = useRef<() => void>(() => {});

  // Initialise the pad and keep the canvas crisp on high-DPI screens.
  //
  // Sizing is driven by a ResizeObserver (not a mount-time read + window
  // resize listener) because BOTH of those bit us in the field:
  //  - at mount the bottom sheet is still animating in, so offsetWidth can be
  //    0 (especially in the native WebView) → a 0×0 canvas that ignores touch;
  //  - the iOS keyboard (opened by the receiver-name input) fires window
  //    resize, and the old handler cleared the pad — wiping the signature.
  // The observer resizes only on real dimension changes and PRESERVES the ink
  // by replaying the base strokes through the new view.
  //
  // The canvas itself is never CSS-transformed: signature_pad maps pointer
  // coordinates via getBoundingClientRect(), which a rotate() would break.
  // Landscape is achieved by rotating the STROKES (the view) and the chrome.
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
    // A resize mid-stroke (e.g. the Android keyboard closing after blur()
    // while the driver is already signing) must not fold the unfinished
    // stroke: clear()+fromData() would swap in a replayed copy that
    // signature_pad keeps appending to, and everything drawn after it would
    // be dropped on the next resize. Defer until the finger lifts.
    let drawing = false;
    let pendingResize = false;
    const applySize = () => {
      if (drawing) {
        pendingResize = true;
        return;
      }
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) return; // not laid out yet — wait for the observer
      const rotation = rotationRef.current;
      const prev = viewRef.current;
      if (prev && w === lastW && h === lastH && prev.rotation === rotation) {
        return;
      }

      // Fold strokes drawn since the last replay into the base space.
      const base = baseRef.current;
      if (prev) {
        const fresh = pad.toData().slice(replayedRef.current);
        if (fresh.length > 0) {
          const inBase = fromView(fresh, prev);
          base.strokes = [...base.strokes, ...inBase];
          base.frame = growFrame(base.frame ?? prev.frame, inBase);
        }
      }
      if (base.strokes.length === 0 || !base.frame) {
        // Nothing to preserve: the base frame is simply the new upright view.
        base.frame =
          rotation === 90
            ? { x: 0, y: 0, width: h, height: w }
            : { x: 0, y: 0, width: w, height: h };
      }

      lastW = w;
      lastH = h;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = w * ratio; // resets the 2d transform — scale once below
      canvas.height = h * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear();

      const view = computeView(base.frame, w, h, rotation);
      viewRef.current = view;
      if (base.strokes.length > 0) pad.fromData(toView(base.strokes, view));
      replayedRef.current = base.strokes.length;
      setHasInk(!pad.isEmpty());
    };
    applySizeRef.current = applySize;
    applySize();

    const observer = new ResizeObserver(() => applySize());
    observer.observe(canvas);

    const onBegin = () => {
      drawing = true;
    };
    const onEnd = () => {
      drawing = false;
      if (pendingResize) {
        pendingResize = false;
        applySize(); // also refreshes hasInk
      } else {
        setHasInk(!pad.isEmpty());
      }
    };
    pad.addEventListener("beginStroke", onBegin);
    pad.addEventListener("endStroke", onEnd);

    return () => {
      observer.disconnect();
      pad.removeEventListener("beginStroke", onBegin);
      pad.removeEventListener("endStroke", onEnd);
      pad.off();
      padRef.current = null;
      applySizeRef.current = () => {};
    };
  }, []);

  // Track viewport orientation (portrait ⇒ rotate the fullscreen pad).
  useEffect(() => {
    const update = () => setPortrait(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // Rotation changes the view even when the canvas size does not.
  useLayoutEffect(() => {
    rotationRef.current = rotated ? 90 : 0;
    applySizeRef.current();
  }, [rotated]);

  const enterFullscreen = useCallback(() => {
    // Dismiss the iOS keyboard (receiver-name input) so it can't cover the pad.
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    setFullscreen(true);
    // Best effort only: rejects on iOS, and on Android Chrome it only works
    // while the document is in browser fullscreen. The CSS rotation is the
    // guaranteed path.
    try {
      const orientation = window.screen?.orientation as LockableOrientation | undefined;
      orientation?.lock?.("landscape")?.catch?.(() => {});
    } catch {
      /* not supported */
    }
  }, []);

  const exitFullscreen = useCallback(() => setFullscreen(false), []);

  // Leaving fullscreen by ANY path — Done, or the sheet unmounting (Escape,
  // backdrop) — releases the orientation lock and moves focus sensibly.
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!fullscreen) return;
    doneRef.current?.focus();
    return () => {
      try {
        (window.screen?.orientation as LockableOrientation | undefined)?.unlock?.();
      } catch {
        /* not supported */
      }
    };
  }, [fullscreen]);

  const handleClear = useCallback(() => {
    padRef.current?.clear();
    baseRef.current.strokes = [];
    replayedRef.current = 0;
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
        data-testid={fullscreen ? "signature-fullscreen" : undefined}
        data-rotated={fullscreen ? String(rotated) : undefined}
        className={cn(
          fullscreen
            ? "driver-theme fixed inset-0 z-[100] flex flex-col gap-3 bg-driver-surface"
            : "contents",
          fullscreen &&
            (rotated
              ? "px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-[max(env(safe-area-inset-top),0.75rem)]"
              : "p-4 pt-[max(env(safe-area-inset-top),1rem)]"),
        )}
      >
        {fullscreen && !rotated ? (
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-driver-text">
              Sign here
            </span>
            <button
              type="button"
              ref={doneRef}
              onClick={exitFullscreen}
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
            // min-h-0: let the pad shrink with the viewport instead of its
            // canvas pushing Clear off-screen.
            fullscreen && "min-h-0 flex-1",
          )}
        >
          <canvas
            ref={canvasRef}
            className={cn(
              "block w-full touch-none",
              fullscreen ? "h-full" : "h-48",
            )}
            aria-label="Signature pad (optional)"
          />
          {!hasInk && !rotated ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-driver-subtle">
              Sign here (optional)
            </span>
          ) : null}
          {!fullscreen ? (
            <button
              type="button"
              onClick={enterFullscreen}
              className="absolute right-2 top-2 rounded-xl border-[1.5px] border-driver-border bg-driver-surface p-2 text-driver-muted"
              aria-label="Sign in full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {fullscreen && !rotated ? (
          <DriverButton
            variant="outline"
            onClick={handleClear}
            disabled={uploading || !hasInk}
          >
            <Eraser className="h-4 w-4" strokeWidth={2.4} />
            Clear
          </DriverButton>
        ) : null}
        {rotated ? (
          // Landscape chrome: a viewport-sized layer, swapped to
          // height × width and rotated 90° clockwise about its centre, laid
          // over the (unrotated) canvas. Only the buttons take pointer
          // events, so the rest of the pad stays signable. Its left edge is
          // the phone's top (notch) and its right edge the home indicator.
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-[100vw] w-[100dvh] -translate-x-1/2 -translate-y-1/2 rotate-90 flex-col justify-between py-5 pl-[max(env(safe-area-inset-top),1.25rem)] pr-[max(env(safe-area-inset-bottom),1.25rem)]">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-driver-surface/80 px-2 py-1 text-[15px] font-semibold text-driver-text">
                Sign here
              </span>
              <button
                type="button"
                ref={doneRef}
              onClick={exitFullscreen}
                className="pointer-events-auto flex items-center gap-1.5 rounded-xl border-[1.5px] border-driver-border bg-driver-surface px-3 py-1.5 text-[12.5px] font-semibold text-driver-muted"
                aria-label="Exit full screen"
              >
                <Minimize2 className="h-4 w-4" />
                Done
              </button>
            </div>
            {!hasInk ? (
              <span className="self-center text-[13px] font-semibold text-driver-subtle">
                Sign here (optional)
              </span>
            ) : null}
            <div className="flex items-center">
              <DriverButton
                variant="outline"
                onClick={handleClear}
                disabled={uploading || !hasInk}
                className="pointer-events-auto bg-driver-surface"
              >
                <Eraser className="h-4 w-4" strokeWidth={2.4} />
                Clear
              </DriverButton>
            </div>
          </div>
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
