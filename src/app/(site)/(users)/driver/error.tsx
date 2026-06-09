"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { DriverScreen, StateBlock, DriverButton } from "@/components/Driver/ui";

/**
 * Segment-level error boundary for the driver app.
 *
 * Without this, any thrown Server Component (e.g. the history page's DB lookup
 * failing under connection-pool pressure) bubbles to the global 500 page — a
 * jarring full-app error for a driver mid-shift. This keeps the driver chrome
 * (theme, bottom nav, shift pill from the layout) and offers a one-tap retry.
 */
export default function DriverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Driver route error:", error);
  }, [error]);

  return (
    <DriverScreen title="Something went wrong">
      <StateBlock
        icon={AlertTriangle}
        title="This screen hit a snag"
        body="It's usually temporary. Give it another try in a moment."
        action={
          <DriverButton variant="brand" onClick={reset}>
            Try again
          </DriverButton>
        }
      />
    </DriverScreen>
  );
}
