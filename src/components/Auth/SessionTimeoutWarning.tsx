// src/components/auth/SessionTimeoutWarning.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, RefreshCw } from "lucide-react";

interface SessionTimeoutWarningProps {
  warningTime?: number; // minutes before expiry to show warning
  onExtend?: () => Promise<void>;
  onLogout?: () => Promise<void>;
}

export function SessionTimeoutWarning({
  warningTime = 5,
  onExtend,
  onLogout,
}: SessionTimeoutWarningProps) {
  const { authState, refreshToken, logout } = useUser();
  const [isVisible, setIsVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExtending, setIsExtending] = useState(false);

  useEffect(() => {
    if (!authState.sessionExpiresAt || !authState.user) return;

    const checkSession = () => {
      const now = Date.now();
      const expiresAt = authState.sessionExpiresAt!;
      const timeUntilExpiry = expiresAt - now;
      const warningThreshold = warningTime * 60 * 1000; // Convert to milliseconds

      if (timeUntilExpiry <= warningThreshold && timeUntilExpiry > 0) {
        setIsVisible(true);
        setTimeRemaining(Math.ceil(timeUntilExpiry / 1000));
      } else if (timeUntilExpiry <= 0) {
        // Session expired, trigger logout
        handleLogout();
      } else {
        setIsVisible(false);
      }
    };

    // Check immediately
    checkSession();

    // Set up interval to check every second
    const interval = setInterval(checkSession, 1000);

    return () => clearInterval(interval);
  }, [authState.sessionExpiresAt, authState.user, warningTime]);

  useEffect(() => {
    if (!isVisible || timeRemaining <= 0) return;

    const countdown = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time's up, trigger logout
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [isVisible, timeRemaining]);

  const handleExtend = async () => {
    setIsExtending(true);
    try {
      if (onExtend) {
        await onExtend();
      } else {
        await refreshToken();
      }
      setIsVisible(false);
    } catch (error) {
      console.error("Failed to extend session:", error);
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await logout();
      }
      setIsVisible(false);
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getProgressValue = (): number => {
    const totalTime = warningTime * 60; // Convert to seconds
    return ((totalTime - timeRemaining) / totalTime) * 100;
  };

  if (!isVisible) return null;

  return (
    <Dialog open={isVisible} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Session Timeout Warning
          </DialogTitle>
          <DialogDescription>
            Your session will expire soon. Would you like to extend your
            session?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="font-mono text-3xl font-bold text-orange-600">
                {formatTime(timeRemaining)}
              </div>
              <div className="text-muted-foreground text-sm">
                Time remaining
              </div>
            </div>
          </div>

          <Progress value={getProgressValue()} className="w-full" />

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
              <div className="text-sm text-orange-700">
                <p className="font-medium">Session Security Notice</p>
                <p className="mt-1">
                  For your security, sessions automatically expire after a
                  period of inactivity. Extending your session will keep you
                  logged in without interruption.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={isExtending}
          >
            Sign Out Now
          </Button>
          <Button
            onClick={handleExtend}
            disabled={isExtending}
            className="gap-2"
          >
            {isExtending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Extending...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Extend Session
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
