"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, TriangleAlert } from "lucide-react";
import { DriverScreen, StateBlock, DriverButton, Spinner } from "@/components/Driver/ui";

/**
 * Graceful fallback rendered by the history page when its server-side driver
 * lookup fails (e.g. the DB is briefly unreachable / pool-starved). Keeps the
 * driver chrome and lets the driver retry without a hard 500. `router.refresh()`
 * re-runs the Server Component, so a transient DB hiccup recovers on tap.
 */
export default function HistoryUnavailable() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <DriverScreen title="Your history" subtitle="View and export your deliveries">
      <StateBlock
        icon={TriangleAlert}
        title="History is temporarily unavailable"
        body="We couldn't load your deliveries just now. This is usually brief — try again in a moment."
        action={
          <DriverButton
            variant="brand"
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
          >
            {isPending ? <Spinner size={16} /> : <RefreshCcw className="h-4 w-4" />}
            Try again
          </DriverButton>
        }
      />
    </DriverScreen>
  );
}
