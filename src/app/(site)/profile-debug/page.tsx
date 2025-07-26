"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProfileDebugPage() {
  const { user, userRole, isLoading, error, session, authState } = useUser();
  const router = useRouter();
  const [apiTestResult, setApiTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

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
        color: "bg-yellow-100 text-yellow-800",
      };
    if (error)
      return {
        status: "error",
        color: "bg-red-100 text-red-800",
      };
    if (user)
      return {
        status: "authenticated",
        color: "bg-green-100 text-green-800",
      };
    return {
      status: "unauthenticated",
      color: "bg-gray-100 text-gray-800",
    };
  };

  const authStatus = getAuthStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-slate-800">
            Profile Debug Page
          </h1>
          <p className="text-slate-600">
            Debugging the profile loading issue
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Authentication Status */}
          <Card>
            <CardHeader>
              <CardTitle>Authentication Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                <Badge className={authStatus.color}>
                  {authStatus.status}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">User ID:</span>
                  <span className="text-sm font-mono">{user?.id || "None"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email:</span>
                  <span className="text-sm font-mono">{user?.email || "None"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Role:</span>
                  <span className="text-sm font-mono">{userRole || "None"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Loading:</span>
                  <span className="text-sm font-mono">{isLoading ? "Yes" : "No"}</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">
                    <strong>Error:</strong> {error.message}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auth State Details */}
          <Card>
            <CardHeader>
              <CardTitle>Auth State Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Initialized:</span>
                  <span className="text-sm font-mono">{authState.isInitialized ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Authenticated:</span>
                  <span className="text-sm font-mono">{authState.isAuthenticated ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Loading:</span>
                  <span className="text-sm font-mono">{authState.isLoading ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Retry Count:</span>
                  <span className="text-sm font-mono">{authState.retryCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Test */}
          <Card>
            <CardHeader>
              <CardTitle>Profile API Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testProfileAPI} 
                disabled={isTesting}
                className="w-full"
              >
                {isTesting ? "Testing..." : "Test Profile API"}
              </Button>

              {apiTestResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status:</span>
                    <Badge className={apiTestResult.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {apiTestResult.status}
                    </Badge>
                  </div>
                  
                  {apiTestResult.data && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-800">
                        <strong>Success:</strong> Profile data received
                      </p>
                      <pre className="text-xs mt-2 overflow-auto">
                        {JSON.stringify(apiTestResult.data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {apiTestResult.error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">
                        <strong>Error:</strong> {apiTestResult.error}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation Test */}
          <Card>
            <CardHeader>
              <CardTitle>Navigation Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => router.push("/profile")} 
                className="w-full"
              >
                Go to Profile Page
              </Button>
              
              <Button 
                onClick={() => router.push("/client")} 
                className="w-full"
                variant="outline"
              >
                Go to Client Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 