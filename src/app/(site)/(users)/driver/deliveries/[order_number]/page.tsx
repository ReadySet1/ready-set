"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DriverDeliveryDetail } from "@/components/Driver/DriverDeliveryDetail";

/**
 * Driver Delivery Detail.
 *
 * Wrapped in the new driver app chrome (themed glass header + background, no
 * bottom nav — BottomNav hides itself on this route). The body renders the
 * driver-specific DriverDeliveryDetail view (status timeline + pickup/drop-off
 * blocks + sticky Next-Action + proof-of-delivery), which reuses the exact same
 * order-fetch + status-update + POD endpoints SingleOrder used — so behavior is
 * preserved while the presentation is driver-native.
 */
export default function DriverOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.order_number) {
      const raw = Array.isArray(params.order_number)
        ? params.order_number[0]
        : params.order_number;
      if (raw) setOrderNumber(decodeURIComponent(raw));
    }
  }, [params]);

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header
        className="sticky top-0 z-30 border-b border-driver-border bg-driver-glass backdrop-blur-xl backdrop-saturate-150"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3 lg:max-w-5xl">
          <button
            type="button"
            onClick={() => router.push("/driver")}
            aria-label="Back to dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-driver-muted hover:bg-driver-surface-alt"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-driver-subtle">
              Delivery
            </div>
            <div className="truncate font-mono text-[16px] font-bold text-driver-text">
              {orderNumber ? `#${orderNumber}` : "…"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-2 py-4 lg:max-w-5xl">
        <DriverDeliveryDetail orderNumber={orderNumber} />
      </main>
    </div>
  );
}
