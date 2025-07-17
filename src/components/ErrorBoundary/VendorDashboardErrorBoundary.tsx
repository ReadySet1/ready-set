"use client";

import React, { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class VendorDashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });

    // Log the error for debugging
    console.error(
      "VendorDashboardErrorBoundary caught an error:",
      error,
      errorInfo,
    );

    // Here you could send the error to an error reporting service
    // Example: errorReportingService.captureException(error, { extra: errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  isAccessError = () => {
    const errorMessage = this.state.error?.message || "";
    return (
      errorMessage.includes("403") ||
      errorMessage.includes("Unauthorized") ||
      errorMessage.includes("access denied") ||
      errorMessage.includes("permission")
    );
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isAccessError = this.isAccessError();

      // Default fallback UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mb-4 flex justify-center">
                <div
                  className={`rounded-full p-3 ${isAccessError ? "bg-orange-100" : "bg-red-100"}`}
                >
                  {isAccessError ? (
                    <Lock className="h-8 w-8 text-orange-600" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  )}
                </div>
              </div>
              <CardTitle
                className={`text-xl ${isAccessError ? "text-orange-800" : "text-red-800"}`}
              >
                {isAccessError ? "Access Restricted" : "Something went wrong"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                {isAccessError ? (
                  <p className="mb-4 text-gray-600">
                    You don't have permission to access the vendor dashboard. If
                    you believe this is an error, please contact support or try
                    signing in with a different account.
                  </p>
                ) : (
                  <p className="mb-4 text-gray-600">
                    We're sorry, but there was an error loading the vendor
                    dashboard. Please try again or contact support if the
                    problem persists.
                  </p>
                )}

                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="mb-4 text-left">
                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                      Error Details (Development Only)
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs">
                      {this.state.error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                )}
              </div>

              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                {!isAccessError && (
                  <Button
                    onClick={this.handleRetry}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                )}

                <Link href="/">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Go Home
                  </Button>
                </Link>

                {isAccessError && (
                  <Link href="/sign-in">
                    <Button className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>

              <div className="border-t pt-4 text-center">
                <p className="text-sm text-gray-500">
                  Need help?{" "}
                  <Link
                    href="/contact"
                    className="text-blue-600 underline hover:text-blue-700"
                  >
                    Contact our support team
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
