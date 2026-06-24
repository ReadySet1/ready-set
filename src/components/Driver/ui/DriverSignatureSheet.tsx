"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SignatureCapture } from "@/components/Driver/SignatureCapture";
import { useDriverTheme } from "./DriverThemeProvider";

interface DriverSignatureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  /** Endpoint override (defaults to /api/orders/[order_number]/signature). */
  uploadEndpoint?: string;
  /** Called with the stored signature URL once capture + upload succeeds. */
  onComplete: (url: string) => void;
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "driver-theme max-h-[90dvh] overflow-auto rounded-t-3xl border-driver-border bg-driver-surface",
          resolved === "dark" && "dark",
        )}
      >
        <div className="mx-auto w-full max-w-2xl">
          <SheetHeader className="items-start">
            <SheetTitle className="text-[18px] font-extrabold text-driver-text">
              Vendor pickup signature
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
