"use client";

import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function TestLoginPage() {
  const { user, userRole, isLoading, error, session, authState } = useUser();
  const router = useRouter();
  const [loginData, setLoginData] = useState({
    email: "test@example.com",
    password: "password",
  });
  const [loginStatus, setLoginStatus] = useState<string>("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginStatus("Logging in...");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      });

      if (response.ok) {
        setLoginStatus("Login successful! Redirecting...");
        // Refresh the page to update authentication state
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        const errorData = await response.json();
        setLoginStatus(`Login failed: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      setLoginStatus(`Login error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value,
    });
  };

  const navigateToTest = () => {
    router.push("/test-account-settings");
  };

  const navigateToClientDashboard = () => {
    router.push("/client");
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Test Login for Account Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Authentication Status */}
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Current Authentication Status</h3>
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

            {/* Login Form */}
            {!user && (
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-4">Login to Test Account Settings</h3>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-1">
                      Email
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={loginData.email}
                      onChange={handleInputChange}
                      placeholder="test@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-1">
                      Password
                    </label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={loginData.password}
                      onChange={handleInputChange}
                      placeholder="password"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                  {loginStatus && (
                    <p className={`text-sm ${loginStatus.includes("successful") ? "text-green-600" : "text-red-600"}`}>
                      {loginStatus}
                    </p>
                  )}
                </form>
              </div>
            )}

            {/* Navigation Options */}
            {user && (
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-4">Test Navigation</h3>
                <div className="flex gap-2">
                  <Button onClick={navigateToTest} variant="outline">
                    Test Account Settings
                  </Button>
                  <Button onClick={navigateToClientDashboard} variant="outline">
                    Go to Client Dashboard
                  </Button>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>If not logged in, use the login form above with test credentials</li>
                <li>Once logged in, click "Test Account Settings" to verify the functionality</li>
                <li>Or click "Go to Client Dashboard" to test the Account Settings link</li>
                <li>The test credentials are: test@example.com / password</li>
                <li>If login fails, you may need to create a test user in the database</li>
              </ol>
            </div>

            {/* Test Credentials Info */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-2">Test Credentials</h3>
              <div className="text-sm text-yellow-800">
                <p><strong>Email:</strong> test@example.com</p>
                <p><strong>Password:</strong> password</p>
                <p><strong>Role:</strong> client</p>
                <p className="mt-2 text-xs">
                  Note: These credentials are for testing purposes only. If they don't work, 
                  you may need to create a test user in your database.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 