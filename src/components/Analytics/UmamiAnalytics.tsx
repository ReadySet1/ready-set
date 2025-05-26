"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSTANTS } from "@/constants";

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, any>) => void;
    };
  }
}

interface TrackingPreferences {
  analytics?: boolean;
  marketing?: boolean;
}

export default function UmamiAnalytics() {
  const [shouldLoadScript, setShouldLoadScript] = useState(false);

  useEffect(() => {
    try {
      const preferences: TrackingPreferences = JSON.parse(
        localStorage.getItem("cookiePreferences") || "{}"
      );
      
      // Load Umami if analytics consent is given
      setShouldLoadScript(!!preferences.analytics);
    } catch (error) {
      console.error("Error parsing cookie preferences:", error);
      setShouldLoadScript(false);
    }
  }, []);

  return shouldLoadScript ? (
    <Script
      async
      src="https://analytics.umami.is/script.js"
      data-website-id={CONSTANTS.UMAMI_WEBSITE_ID}
      strategy="afterInteractive"
      id="umami-script"
      onLoad={() => {
        console.log("✅ Umami analytics script loaded successfully");
      }}
      onError={(error) => {
        console.error("❌ Failed to load Umami analytics script:", error);
      }}
    />
  ) : null;
} 