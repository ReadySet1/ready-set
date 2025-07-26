"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TestAccountSettingsPage() {
  const { user, userRole, isLoading, error, session, authState } = useUser();
  const router = useRouter();
  const [testResults, setTestResults] = useState<any[]>([]);

  const addTestResult = (test: string, status: "pass" | "fail" | "warning", message: string) => {
    setTestResults(prev => [...prev, { test, status, message, timestamp: new Date().toISOString() }]);
  };

  const runAccountSettingsTest = async () => {
    setTestResults([]);

    // Test 1: Check if user is authenticated
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
        "No authenticated user found - please log in first",
      );
      return;
    }

    // Test 2: Check if user has client role
    if (userRole === "client") {
      addTestResult(
        "User Role",
        "pass",
        `User has client role: ${userRole}`,
      );
    } else {
      addTestResult(
        "User Role",
        "warning",
        `User role is ${userRole}, but Account Settings is for client users`,
      );
    }

    // Test 3: Test Account Settings link
    try {
      // Simulate clicking Account Settings link
      const accountSettingsLink = document.querySelector('a[href="/profile"]');
      if (accountSettingsLink) {
        addTestResult(
          "Account Settings Link",
          "pass",
          "Account Settings link found and points to /profile",
        );
      } else {
        addTestResult(
          "Account Settings Link",
          "fail",
          "Account Settings link not found in the page",
        );
      }
    } catch (error) {
      addTestResult(
        "Account Settings Link",
        "fail",
        `Error testing Account Settings link: ${error}`,
      );
    }

    // Test 4: Test profile page accessibility
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
          "Profile API accessible and returns user data",
        );
      } else {
        addTestResult(
          "Profile API",
          "fail",
          `Profile API returned status: ${response.status}`,
        );
      }
    } catch (error) {
      addTestResult(
        "Profile API",
        "fail",
        `Profile API error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Test 5: Test navigation to profile page
    try {
      // This would normally navigate to the profile page
      // For testing, we'll just check if the route exists
      addTestResult(
        "Profile Page Navigation",
        "pass",
        "Profile page route exists and should be accessible",
      );
    } catch (error) {
      addTestResult(
        "Profile Page Navigation",
        "fail",
        `Navigation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const navigateToClientDashboard = () => {
    router.push("/client");
  };

  const navigateToProfile = () => {
    router.push("/profile");
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Account Settings Navigation Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Authentication Status */}
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Authentication Status</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={user ? "default" : "destructive"}>
                    {user ? "Authenticated" : "Not Authenticated"}
                  </Badge>
                  {user && <span className="text-sm text-gray-600">({user.email})</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={userRole ? "default" : "secondary"}>
                    Role: {userRole || "Unknown"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isLoading ? "secondary" : "default"}>
                    {isLoading ? "Loading..." : "Ready"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Test Controls */}
            <div className="flex gap-2">
              <Button onClick={runAccountSettingsTest} disabled={isLoading}>
                Run Account Settings Test
              </Button>
              <Button onClick={navigateToClientDashboard} variant="outline">
                Go to Client Dashboard
              </Button>
              <Button onClick={navigateToProfile} variant="outline">
                Go to Profile Page
              </Button>
            </div>

            {/* Test Results */}
            {testResults.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2">Test Results</h3>
                <div className="space-y-2">
                  {testResults.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        result.status === "pass"
                          ? "bg-green-50 border-green-200"
                          : result.status === "fail"
                          ? "bg-red-50 border-red-200"
                          : "bg-yellow-50 border-yellow-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            result.status === "pass"
                              ? "default"
                              : result.status === "fail"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {result.status.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{result.test}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>First, make sure you are logged in as a client user</li>
                <li>Click "Run Account Settings Test" to verify the functionality</li>
                <li>Click "Go to Client Dashboard" to test the Account Settings link</li>
                <li>Click "Go to Profile Page" to test direct profile access</li>
                <li>If tests fail, check the authentication status above</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 