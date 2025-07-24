"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  User,
  Shield,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

export default function DiagnosticPage() {
  const { user, userRole, isLoading, error, session } = useUser();
  const [supabaseClient, setSupabaseClient] = useState<any>(null);
  const [apiTestResult, setApiTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const initClient = async () => {
      try {
        const client = createClient();
        setSupabaseClient(client);
      } catch (err) {
        console.error("Failed to initialize Supabase client:", err);
      }
    };
    initClient();
  }, []);

  const testProfileAPI = async () => {
    setIsTesting(true);
    try {
      const response = await fetch("/api/profile", {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      const result = {
        status: response.status,
        ok: response.ok,
        data: response.ok ? await response.json() : null,
        error: !response.ok ? await response.text() : null,
      };

      setApiTestResult(result);
    } catch (err) {
      setApiTestResult({
        status: "ERROR",
        ok: false,
        data: null,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getAuthStatus = () => {
    if (isLoading)
      return {
        status: "loading",
        icon: RefreshCw,
        color: "bg-yellow-100 text-yellow-800",
      };
    if (error)
      return {
        status: "error",
        icon: AlertCircle,
        color: "bg-red-100 text-red-800",
      };
    if (user)
      return {
        status: "authenticated",
        icon: CheckCircle,
        color: "bg-green-100 text-green-800",
      };
    return {
      status: "unauthenticated",
      icon: Shield,
      color: "bg-gray-100 text-gray-800",
    };
  };

  const authStatus = getAuthStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-slate-800">
            Authentication Diagnostic
          </h1>
          <p className="text-slate-600">
            Monitor authentication state and debug issues
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* UserContext State */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                UserContext State
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <authStatus.icon className="h-4 w-4" />
                <Badge className={authStatus.color}>{authStatus.status}</Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <strong>Loading:</strong> {isLoading ? "Yes" : "No"}
                </div>
                <div>
                  <strong>Has User:</strong> {user ? "Yes" : "No"}
                </div>
                <div>
                  <strong>User ID:</strong> {user?.id || "N/A"}
                </div>
                <div>
                  <strong>User Role:</strong> {userRole || "N/A"}
                </div>
                <div>
                  <strong>Has Session:</strong> {session ? "Yes" : "No"}
                </div>
                {error && (
                  <div>
                    <strong>Error:</strong>{" "}
                    <span className="text-red-600">{String(error)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* API Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Profile API Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={testProfileAPI}
                disabled={isTesting}
                className="w-full"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Profile API"
                )}
              </Button>

              {apiTestResult && (
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Status:</strong> {apiTestResult.status}
                  </div>
                  <div>
                    <strong>Success:</strong> {apiTestResult.ok ? "Yes" : "No"}
                  </div>
                  {apiTestResult.data && (
                    <div>
                      <strong>Data:</strong>{" "}
                      <pre className="rounded bg-gray-100 p-2 text-xs">
                        {JSON.stringify(apiTestResult.data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {apiTestResult.error && (
                    <div>
                      <strong>Error:</strong>{" "}
                      <span className="text-red-600">
                        {apiTestResult.error}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Details */}
          {user && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>User Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <strong>Email:</strong> {user.email}
                    </div>
                    <div>
                      <strong>Created:</strong>{" "}
                      {new Date(user.created_at).toLocaleString()}
                    </div>
                    <div>
                      <strong>Last Sign In:</strong>{" "}
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleString()
                        : "N/A"}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <strong>User Metadata:</strong>
                    </div>
                    <pre className="overflow-auto rounded bg-gray-100 p-2 text-xs">
                      {JSON.stringify(user.user_metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Session Details */}
          {session && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Session Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Access Token:</strong>{" "}
                    {session.access_token ? "Present" : "Missing"}
                  </div>
                  <div>
                    <strong>Refresh Token:</strong>{" "}
                    {session.refresh_token ? "Present" : "Missing"}
                  </div>
                  <div>
                    <strong>Expires At:</strong>{" "}
                    {session.expires_at
                      ? new Date(session.expires_at * 1000).toLocaleString()
                      : "N/A"}
                  </div>
                  <div>
                    <strong>Token Type:</strong> {session.token_type}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Debug Actions */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Debug Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-3">
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "/profile")}
                  className="w-full"
                >
                  Test Profile Page
                </Button>
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "/client")}
                  className="w-full"
                >
                  Go to Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Refresh Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
