"use client";

import { useEffect } from "react";
import { useWhatsNew } from "@/hooks/useWhatsNew";

/**
 * Invisible client component: marks the latest changelog version as seen
 * when the user lands on /changelog, clearing the "What's New" badge dot.
 */
export function MarkChangelogSeen() {
  const { markSeen } = useWhatsNew();

  useEffect(() => {
    markSeen();
  }, [markSeen]);

  return null;
}

export default MarkChangelogSeen;
