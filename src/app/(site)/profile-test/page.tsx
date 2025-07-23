"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  Shield,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ArrowRight,
  Home,
} from "lucide-react";

export default function ProfileTestPage() {
  const router = useRouter();
  const { user, userRole, isLoading, error, session } = useUser();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const addTestResult = (
    test: string,
    status: "pass" | "fail" | "warning",
    message: string,
  ) => {
    setTestResults((prev) => [
      ...prev,
      { test, status, message, timestamp: new Date() },
    ]);
  };

  const runAuthenticationTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);

    // Test 1: UserContext Loading
    if (isLoading) {
      addTestResult(
        "UserContext Loading",
        "warning",
        "UserContext is still loading",
      );
    } else {
      addTestResult(
        "UserContext Loading",
        "pass",
        "UserContext has finished loading",
      );
    }

    // Test 2: User Authentication
    if (user) {
      addTestResult(
        "User Authentication",
        "pass",
        `User authenticated: ${user.email}`,
      );
    } else {
      addTestResult(
        "User Authentication",
        "fail",
        "No authenticated user found",
      );
    }

    // Test 3: Session Check
    if (session) {
      addTestResult("Session Check", "pass", "Valid session found");
    } else {
      addTestResult("Session Check", "fail", "No session found");
    }

    // Test 4: User Role
    if (userRole) {
      addTestResult("User Role", "pass", `User role: ${userRole}`);
    } else {
      addTestResult("User Role", "warning", "No user role assigned");
    }

    // Test 5: Profile API
    try {
      const response = await fetch("/api/profile", {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (response.ok) {
        const data = await response.json();
        addTestResult(
          "Profile API",
          "pass",
          "Profile API returned data successfully",
        );
      } else {
        addTestResult(
          "Profile API",
          "fail",
          `Profile API failed with status: ${response.status}`,
        );
      }
    } catch (err) {
      addTestResult(
        "Profile API",
        "fail",
        `Profile API error: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }

    // Test 6: Error State
    if (error) {
      addTestResult("Error State", "fail", `UserContext error: ${error}`);
    } else {
      addTestResult("Error State", "pass", "No errors in UserContext");
    }

    setIsRunningTests(false);
  };

  const getStatusIcon = (status: "pass" | "fail" | "warning") => {
    switch (status) {
      case "pass":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "fail":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: "pass" | "fail" | "warning") => {
    switch (status) {
      case "pass":
        return "border-green-200 bg-green-50";
      case "fail":
        return "border-red-200 bg-red-50";
      case "warning":
        return "border-yellow-200 bg-yellow-50";
    }
  };

  const canAccessProfile = user && !isLoading && !error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-slate-800">
            Profile Authentication Test
          </h1>
          <p className="text-slate-600">
            Test the authentication flow for the profile page
          </p>
        </div>

        {/* Current State Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Current Authentication State
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>
                    <strong>User:</strong>{" "}
                    {user ? user.email : "Not authenticated"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                  <span>
                    <strong>Loading:</strong> {isLoading ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>
                    <strong>Role:</strong> {userRole || "None"}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <strong>Session:</strong> {session ? "Present" : "Missing"}
                </div>
                <div>
                  <strong>Error:</strong> {error || "None"}
                </div>
                <div>
                  <strong>Can Access Profile:</strong>{" "}
                  {canAccessProfile ? "Yes" : "No"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={runAuthenticationTests}
              disabled={isRunningTests}
              className="mb-4"
            >
              {isRunningTests ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                "Run Authentication Tests"
              )}
            </Button>

            {testResults.length > 0 && (
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <Alert key={index} className={getStatusColor(result.status)}>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <AlertDescription>
                        <strong>{result.test}:</strong> {result.message}
                      </AlertDescription>
                    </div>
                  </Alert>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid gap-4 md:grid-cols-3">
          <Button
            onClick={() => router.push("/profile")}
            disabled={!canAccessProfile}
            className="w-full"
          >
            <User className="mr-2 h-4 w-4" />
            Go to Profile
          </Button>

          <Button
            onClick={() => router.push("/client")}
            variant="outline"
            className="w-full"
          >
            <Home className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Button>

          <Button
            onClick={() => router.push("/diagnostic")}
            variant="outline"
            className="w-full"
          >
            <Shield className="mr-2 h-4 w-4" />
            Full Diagnostic
          </Button>
        </div>

        {/* Recommendations */}
        {testResults.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {!user && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Authentication Required:</strong> You need to sign
                    in to access the profile page.
                  </AlertDescription>
                </Alert>
              )}

              {user && !userRole && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Role Assignment:</strong> Your user role hasn't been
                    assigned yet. This might cause issues.
                  </AlertDescription>
                </Alert>
              )}

              {canAccessProfile && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Ready to Test:</strong> Your authentication state
                    looks good. You should be able to access the profile page.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
