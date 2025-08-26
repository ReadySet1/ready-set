"use client";

import { useEffect, useState } from "react";

export default function ScrollUp() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && typeof window !== "undefined") {
      try {
        window.document.scrollingElement?.scrollTo(0, 0);
      } catch (error) {
        console.warn("ScrollUp: Error scrolling to top:", error);
      }
    }
  }, [isClient]);

  // Return null during SSR to prevent hydration mismatch
  if (!isClient) {
    return null;
  }

  return null;
}
