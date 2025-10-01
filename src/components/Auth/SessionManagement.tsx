// src/components/auth/SessionManagement.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Clock,
  Shield,
  AlertTriangle,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { EnhancedSession } from "@/types/auth";

interface SessionManagementProps {
  className?: string;
}

export function SessionManagement({ className }: SessionManagementProps) {
  const { getActiveSessions, revokeSession, authState } = useUser();
  const [sessions, setSessions] = useState<EnhancedSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load sessions on mount and periodically
  useEffect(() => {
    loadSessions();

    const interval = setInterval(loadSessions, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const activeSessions = await getActiveSessions();
      setSessions(activeSessions);
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError("Failed to load active sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setIsRevoking(sessionId);
      await revokeSession(sessionId);
      await loadSessions(); // Refresh the list
    } catch (err) {
      console.error("Failed to revoke session:", err);
      setError("Failed to revoke session");
    } finally {
      setIsRevoking(null);
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    if (
      userAgent.includes("Mobile") ||
      userAgent.includes("Android") ||
      userAgent.includes("iPhone")
    ) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (userAgent.includes("Tablet") || userAgent.includes("iPad")) {
      return <Tablet className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getDeviceType = (userAgent: string): string => {
    if (
      userAgent.includes("Mobile") ||
      userAgent.includes("Android") ||
      userAgent.includes("iPhone")
    ) {
      return "Mobile";
    }
    if (userAgent.includes("Tablet") || userAgent.includes("iPad")) {
      return "Tablet";
    }
    return "Desktop";
  };

  const getBrowserName = (userAgent: string): string => {
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    return "Unknown";
  };

  const isCurrentSession = (session: EnhancedSession): boolean => {
    return session.id === authState.enhancedSession?.id;
  };

  const isSessionExpired = (session: EnhancedSession): boolean => {
    return session.expiresAt < Date.now();
  };

  if (isLoading && sessions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage your active sessions across different devices and browsers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="text-muted-foreground h-6 w-6 animate-spin" />
            <span className="text-muted-foreground ml-2">
              Loading sessions...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Manage your active sessions across different devices and browsers
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSessions}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-3">
            <div className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="py-8 text-center">
            <Shield className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground">No active sessions found</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getDeviceIcon(session.deviceInfo.userAgent)}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {getDeviceType(session.deviceInfo.userAgent)} -{" "}
                        {getBrowserName(session.deviceInfo.userAgent)}
                      </span>
                      {isCurrentSession(session) && (
                        <Badge variant="secondary" className="text-xs">
                          Current Session
                        </Badge>
                      )}
                      {isSessionExpired(session) && (
                        <Badge variant="destructive" className="text-xs">
                          Expired
                        </Badge>
                      )}
                      {session.suspiciousActivity && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Suspicious
                        </Badge>
                      )}
                    </div>

                    <div className="text-muted-foreground flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {isSessionExpired(session)
                            ? "Expired"
                            : `Expires ${formatDistanceToNow(session.expiresAt, { addSuffix: true })}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        <span>
                          Active{" "}
                          {formatDistanceToNow(session.lastActivityAt, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>

                    {session.deviceInfo.ip && (
                      <div className="text-muted-foreground flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3" />
                        <span>IP: {session.deviceInfo.ip}</span>
                      </div>
                    )}
                  </div>
                </div>

                {!isCurrentSession(session) && !isSessionExpired(session) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Session</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to revoke this session? The user
                          will be signed out from this device immediately.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={isRevoking === session.id}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          {isRevoking === session.id ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Revoking...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Revoke Session
                            </>
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {session !== sessions[sessions.length - 1] && <Separator />}
            </div>
          ))
        )}

        <div className="border-t pt-4">
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>Total active sessions: {sessions.length}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                /* Open session settings modal */
              }}
            >
              Session Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Session settings modal component
export function SessionSettingsDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Session Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Session Management Settings</DialogTitle>
          <DialogDescription>
            Configure how your sessions behave across devices and browsers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Session Timeout</label>
            <p className="text-muted-foreground text-sm">
              Sessions automatically expire after 15 minutes of inactivity for
              security.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Cross-Tab Synchronization
            </label>
            <p className="text-muted-foreground text-sm">
              Session state is synchronized across all open browser tabs
              automatically.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">Security Features</label>
            <div className="text-muted-foreground space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>Device fingerprinting enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>Suspicious activity detection</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>Automatic token refresh</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
