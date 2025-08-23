// src/components/ErrorBoundary/AuthErrorBoundary.tsx
"use client";

import React, { Component, ReactNode } from "react";
import { clearAllHydrationData } from "@/utils/auth/hydration";
import { clearSupabaseCookies } from "@/utils/supabase/client";

interface AuthErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  retryCount: number;
}

interface AuthErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class AuthErrorBoundary extends Component<
  AuthErrorBoundaryProps,
  AuthErrorBoundaryState
> {
  private maxRetries = 2;
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(
    error: Error,
  ): Partial<AuthErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details
    console.error("AuthErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo: errorInfo.componentStack,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Check if this looks like an auth-related error
    if (this.isAuthError(error)) {
      console.log("Auth error detected, clearing auth state...");
      this.handleAuthError();
    }
  }

  private isAuthError = (error: Error): boolean => {
    const authErrorIndicators = [
      "auth",
      "session",
      "token",
      "unauthorized",
      "forbidden",
      "supabase",
      "user context",
      "authentication",
    ];

    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || "";

    return authErrorIndicators.some(
      (indicator) =>
        errorMessage.includes(indicator) || errorStack.includes(indicator),
    );
  };

  private handleAuthError = () => {
    try {
      // Clear all auth-related data
      clearAllHydrationData();
      clearSupabaseCookies();

      // Attempt automatic retry if under limit
      if (this.state.retryCount < this.maxRetries) {
        console.log(
          `Attempting auth error recovery (attempt ${this.state.retryCount + 1}/${this.maxRetries})...`,
        );

        this.retryTimeout = setTimeout(
          () => {
            this.setState((prevState) => ({
              hasError: false,
              error: null,
              errorInfo: null,
              retryCount: prevState.retryCount + 1,
            }));
          },
          1000 * (this.state.retryCount + 1),
        ); // Exponential backoff
      } else {
        console.log(
          "Max auth error retries exceeded, manual intervention required",
        );
      }
    } catch (cleanupError) {
      console.error("Error during auth error cleanup:", cleanupError);
    }
  };

  private handleManualRetry = () => {
    console.log("Manual retry triggered...");

    // Clear auth state
    try {
      clearAllHydrationData();
      clearSupabaseCookies();
    } catch (cleanupError) {
      console.error("Error during manual cleanup:", cleanupError);
    }

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  private handleRedirectToSignIn = () => {
    // Clear everything and redirect to sign in
    try {
      clearAllHydrationData();
      clearSupabaseCookies();
      window.location.href = "/sign-in?error=Authentication+error+occurred";
    } catch (error) {
      console.error("Error during redirect:", error);
      // Fallback: force page reload
      window.location.reload();
    }
  };

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <svg
                  className="h-6 w-6 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
                Authentication Error
              </h3>

              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                {this.isAuthError(this.state.error!)
                  ? "There was a problem with your authentication. Please try signing in again."
                  : "Something went wrong. Please try again or contact support if the problem persists."}
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mb-4 text-left">
                  <summary className="mb-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                    Error Details (Development Only)
                  </summary>
                  <div className="max-h-32 overflow-y-auto rounded bg-gray-100 p-3 font-mono text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.errorInfo && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">
                          {this.state.errorInfo}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="space-y-3">
                {this.state.retryCount < this.maxRetries && (
                  <button
                    onClick={this.handleManualRetry}
                    className="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Try Again
                  </button>
                )}

                <button
                  onClick={this.handleRedirectToSignIn}
                  className="inline-flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Sign In Again
                </button>
              </div>

              {this.state.retryCount >= this.maxRetries && (
                <p className="mt-4 text-xs text-yellow-600 dark:text-yellow-400">
                  Multiple attempts failed. Please contact support if this
                  continues.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AuthErrorBoundary;
