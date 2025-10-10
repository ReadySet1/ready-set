"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/contexts/UserContext";

/**
 * ActivityTracker component
 * Tracks user activity and automatically refreshes the session
 * when the user is actively using the app, preventing unnecessary
 * session timeout warnings.
 */
export function ActivityTracker() {
  const { authState, refreshToken } = useUser();
  const lastActivityRef = useRef<number>(Date.now());
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only track activity if user is logged in
    if (!authState.user || !authState.sessionExpiresAt) return;

    const ACTIVITY_EVENTS = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    // Throttle activity updates to once per minute
    const ACTIVITY_THROTTLE = 60 * 1000; // 1 minute

    const handleActivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      // Only update if enough time has passed since last activity
      if (timeSinceLastActivity >= ACTIVITY_THROTTLE) {
        lastActivityRef.current = now;

        // Check if session is expiring soon (within 6 minutes)
        const timeUntilExpiry = authState.sessionExpiresAt! - now;
        const SIX_MINUTES = 6 * 60 * 1000;

        // Auto-refresh if session expires in less than 6 minutes
        if (timeUntilExpiry < SIX_MINUTES && timeUntilExpiry > 0) {
          // Clear any existing timer
          if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
          }

          // Debounce the refresh to avoid too many calls
          refreshTimerRef.current = setTimeout(() => {
            refreshToken().catch((error) => {
              console.error("Failed to auto-refresh session:", error);
            });
          }, 2000); // Wait 2 seconds before refreshing
        }
      }
    };

    // Add event listeners for user activity
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup
    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [authState.user, authState.sessionExpiresAt, refreshToken]);

  return null; // This component doesn't render anything
}
