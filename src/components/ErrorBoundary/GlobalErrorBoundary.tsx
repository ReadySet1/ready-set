// src/components/ErrorBoundary/GlobalErrorBoundary.tsx
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { collectErrorContext } from "@/lib/error-logging";
import { captureException } from "@/lib/monitoring/sentry";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, Home, Bug } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
  showDetails?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

/**
 * Enhanced global error boundary with comprehensive error handling and reporting
 * Integrates with Sentry for error tracking and monitoring
 */
class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Collect comprehensive error context
    const errorContext = collectErrorContext({
      errorBoundary: {
        name: this.props.name || "GlobalErrorBoundary",
        level: "global",
        retryCount: 0, // Global boundary doesn't retry, it resets
      },
    });

    // Capture error to Sentry with comprehensive context
    captureException(error, {
      component: this.props.name || "GlobalErrorBoundary",
      feature: 'error-boundary',
      componentStack: errorInfo.componentStack || undefined,
      metadata: {
        boundaryName: this.props.name || "GlobalErrorBoundary",
        level: "global",
        retryCount: 0,
        ...errorContext,
      }
    });

    // Update state to include errorInfo
    this.setState({ errorInfo });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Additional logging for debugging (development only)
    if (process.env.NODE_ENV === "development") {
      console.group("🚨 React Global Error Boundary Caught Error");
      console.error("Error:", error);
      console.error("Error Info:", errorInfo);
      console.error("Component Stack:", errorInfo.componentStack);
      console.error("Error Context:", errorContext);
      console.groupEnd();
    }
  }

  handleRetry = (): void => {
    // Clear error state to retry rendering
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined,
    });
  };

  handleReload = (): void => {
    // Reload the page to completely reset the app state
    window.location.reload();
  };

  handleGoHome = (): void => {
    // Navigate to home page
    window.location.href = "/";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default enhanced error UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
          <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
            {/* Error Icon and Title */}
            <div className="mb-6 flex items-center justify-center">
              <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <div className="mb-8 text-center">
              <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                Something went wrong
              </h1>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                An unexpected error occurred. Our team has been notified and is
                working on a fix.
              </p>

              {this.state.errorId && (
                <div className="mb-4 text-sm text-gray-500 dark:text-gray-500">
                  Error ID:{" "}
                  <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">
                    {this.state.errorId}
                  </code>
                </div>
              )}
            </div>

            {/* Error Details (Development/Debug Mode) */}
            {(this.props.showDetails ||
              process.env.NODE_ENV === "development") &&
              this.state.error && (
                <div className="mb-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-700">
                  <details className="cursor-pointer">
                    <summary className="mb-2 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Bug className="mr-2 h-4 w-4" />
                      Error Details (Development Mode)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                          Error Message
                        </h4>
                        <p className="rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                          {this.state.error.message}
                        </p>
                      </div>

                      {this.state.error.stack && (
                        <div>
                          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                            Stack Trace
                          </h4>
                          <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}

                      {this.state.errorInfo?.componentStack && (
                        <div>
                          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                            Component Stack
                          </h4>
                          <pre className="max-h-40 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}

            {/* Action Buttons */}
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                onClick={this.handleRetry}
                variant="default"
                className="flex items-center justify-center"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>

              <Button
                onClick={this.handleReload}
                variant="outline"
                className="flex items-center justify-center"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Page
              </Button>

              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="flex items-center justify-center"
              >
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            </div>

            {/* Additional Help */}
            <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-600">
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                <p className="mb-2">
                  If this problem persists, please contact our support team.
                </p>
                <div className="flex justify-center space-x-4 text-xs">
                  <button
                    onClick={() =>
                      window.open(
                        "mailto:support@readysetcorp.com?subject=Error Report&body=Error ID: " +
                          this.state.errorId,
                        "_blank",
                      )
                    }
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Email Support
                  </button>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button
                    onClick={() => window.open("/contact", "_blank")}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Contact Form
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
