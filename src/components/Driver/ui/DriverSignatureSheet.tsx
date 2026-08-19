"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SignatureCapture } from "@/components/Driver/SignatureCapture";
import { useVisualViewportInset } from "@/hooks/useVisualViewportInset";
import { useDriverTheme } from "./DriverThemeProvider";

interface DriverSignatureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  /** Endpoint override (defaults to /api/orders/[order_number]/signature). */
  uploadEndpoint?: string;
  /** Called once the confirmation is stored. `url` is the signature image URL
   *  when one was drawn, or null for a name-only confirmation. */
  onComplete: (url: string | null) => void;
}

/** Bottom-sheet wrapper around the pickup SignatureCapture flow. Mirrors
 *  DriverPodSheet (driver-theme scoped bottom sheet). */
export function DriverSignatureSheet({
  open,
  onOpenChange,
  orderNumber,
  uploadEndpoint,
  onComplete,
}: DriverSignatureSheetProps) {
  const { resolved } = useDriverTheme();
  // iOS WKWebView keyboard handling: the keyboard slides OVER this fixed
  // bottom sheet without resizing the layout viewport (2026-08-18 field
  // failure — the receiver-name input disappeared behind the keyboard and the
  // driver had to close/reopen the sheet). Pad the scrollable content by the
  // occluded height so the input and action buttons stay reachable. Scoped
  // here on purpose — the shared sheet primitive stays untouched.
  const keyboardInset = useVisualViewportInset();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "driver-theme max-h-[90dvh] overflow-auto rounded-t-3xl border-driver-border bg-driver-surface",
          resolved === "dark" && "dark",
        )}
        style={keyboardInset > 0 ? { paddingBottom: keyboardInset } : undefined}
        onFocusCapture={(event) => {
          // With the padding in place there IS room below the keyboard, but
          // WebKit doesn't auto-scroll inputs inside overflow containers.
          // Delay past the keyboard slide-in so the visual viewport has its
          // final size before we scroll.
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          if (!target.matches("input, textarea")) return;
          window.setTimeout(() => {
            target.scrollIntoView?.({ block: "center", behavior: "smooth" });
          }, 300);
        }}
      >
        <div className="mx-auto w-full max-w-2xl">
          <SheetHeader className="items-start">
            <SheetTitle className="text-[18px] font-semibold text-driver-text">
              Confirm pickup
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <SignatureCapture
              orderNumber={orderNumber}
              uploadEndpoint={uploadEndpoint}
              onUploadComplete={(url) => onComplete(url)}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
