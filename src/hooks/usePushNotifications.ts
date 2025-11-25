"use client";

import { useCallback, useEffect, useState } from "react";
import { requestFcmToken } from "@/lib/firebase-web";

type PushStatus =
  | "idle"
  | "requesting_permission"
  | "enabled"
  | "disabled"
  | "unsupported"
  | "error";

interface UsePushNotificationsState {
  status: PushStatus;
  error?: string;
  isSupported: boolean;
}

interface UsePushNotificationsResult extends UsePushNotificationsState {
  enableOnThisDevice: () => Promise<void>;
  disableAllDevices: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

function checkBrowserSupport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hasNotification = "Notification" in window;
  const hasServiceWorker = "serviceWorker" in navigator;
  const hasPushManager = "PushManager" in window;

  return hasNotification && hasServiceWorker && hasPushManager;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [state, setState] = useState<UsePushNotificationsState>({
    status: "idle",
    isSupported: false,
  });

  const fetchPreferences = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    const isSupported = checkBrowserSupport();
    if (!isSupported) {
      setState({
        status: "unsupported",
        isSupported: false,
      });
      return;
    }

    try {
      const response = await fetch("/api/notifications/push/preferences", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setState((prev) => ({
          ...prev,
          status: "disabled",
          isSupported: true,
        }));
        return;
      }

      const json = await response.json();
      const hasPushNotifications = Boolean(json.hasPushNotifications);

      setState({
        status: hasPushNotifications ? "enabled" : "disabled",
        isSupported: true,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch push preferences.";
      setState({
        status: "error",
        error: message,
        isSupported: isSupported,
      });
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const enableOnThisDevice = useCallback(async () => {
    if (!checkBrowserSupport()) {
      setState({
        status: "unsupported",
        isSupported: false,
        error: "This browser does not support push notifications.",
      });
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        status: "requesting_permission",
        error: undefined,
      }));

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState({
          status: "disabled",
          isSupported: true,
          error: "Notification permission was not granted.",
        });
        return;
      }

      // Ensure service worker is registered
      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );

      if (!registration) {
        setState({
          status: "error",
          isSupported: true,
          error: "Failed to register service worker for push notifications.",
        });
        return;
      }

      const token = await requestFcmToken();
      if (!token) {
        setState({
          status: "error",
          isSupported: true,
          error: "Failed to obtain push notification token.",
        });
        return;
      }

      const platform = navigator.platform || "";
      const userAgent = navigator.userAgent || "";

      const response = await fetch("/api/notifications/push/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          token,
          platform,
          userAgent,
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        const message =
          json?.message || "Failed to register this device for push notifications.";

        setState({
          status: "error",
          isSupported: true,
          error: message,
        });
        return;
      }

      // Ensure account-level preference is enabled
      await fetch("/api/notifications/push/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ hasPushNotifications: true }),
      });

      setState({
        status: "enabled",
        isSupported: true,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to enable push notifications.";

      setState({
        status: "error",
        isSupported: checkBrowserSupport(),
        error: message,
      });
    }
  }, []);

  const disableAllDevices = useCallback(async () => {
    try {
      await fetch("/api/notifications/push/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ hasPushNotifications: false }),
      });

      setState((prev) => ({
        ...prev,
        status: "disabled",
      }));
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to disable push notifications.";
      setState((prev) => ({
        ...prev,
        status: "error",
        error: message,
      }));
    }
  }, []);

  const refreshPreferences = useCallback(async () => {
    await fetchPreferences();
  }, [fetchPreferences]);

  return {
    ...state,
    enableOnThisDevice,
    disableAllDevices,
    refreshPreferences,
  };
}


