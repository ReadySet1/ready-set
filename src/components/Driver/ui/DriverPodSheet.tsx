"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ProofOfDeliveryCapture } from "@/components/Driver/ProofOfDeliveryCapture";
import { useDriverTheme } from "./DriverThemeProvider";

interface DriverPodSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string;
  orderNumber: string;
  /** Endpoint override (defaults to /api/tracking/deliveries/[id]/pod). */
  uploadEndpoint?: string;
  /** Called with the uploaded image URL once capture+upload succeeds. */
  onComplete: (url: string) => void;
}

/** Bottom-sheet wrapper around the existing ProofOfDeliveryCapture flow
 *  (capture → preview → upload, with offline queueing built in). */
export function DriverPodSheet({
  open,
  onOpenChange,
  deliveryId,
  orderNumber,
  uploadEndpoint,
  onComplete,
}: DriverPodSheetProps) {
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
              Proof of delivery
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ProofOfDeliveryCapture
              deliveryId={deliveryId}
              orderNumber={orderNumber}
              isRequired
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
