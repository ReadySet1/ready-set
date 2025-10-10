// src/components/ErrorBoundary/SectionErrorBoundary.tsx
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  createErrorBoundaryLogger,
  collectErrorContext,
  ErrorSeverity,
  ErrorCategory,
} from "@/lib/error-logging";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug } from "lucide-react";

interface Props {
  children: ReactNode;
  sectionName: string;
  fallback?: ReactNode;
  showDetails?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRetry?: boolean;
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  retryCount: number;
  isRetrying: boolean;
}

/**
 * Section-level error boundary for isolating errors in different app sections
 * Provides section-specific error handling and recovery options
 */
class SectionErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;
  private errorLogger: (
    error: Error,
    errorInfo: any,
    additionalContext?: Record<string, any>,
  ) => void;

  static defaultProps = {
    enableRetry: true,
    maxRetries: 3,
    showDetails: false,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
      isRetrying: false,
    };

    // Initialize error logger for this section
    this.errorLogger = createErrorBoundaryLogger(props.sectionName, "section");
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `section_error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Collect comprehensive error context
    const errorContext = collectErrorContext({
      errorBoundary: {
        name: this.props.sectionName,
        level: "section",
        retryCount: this.state.retryCount,
      },
    });

    // Log error with section context
    this.errorLogger(error, errorInfo, {
      sectionName: this.props.sectionName,
      retryCount: this.state.retryCount,
      errorContext,
    });

    // Update state to include errorInfo
    this.setState({ errorInfo });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Additional logging for debugging
    console.group(`🚨 Section Error Boundary: ${this.props.sectionName}`);
    console.error("Error:", error);
    console.error("Error Info:", errorInfo);
    console.error("Component Stack:", errorInfo.componentStack);
    console.error("Retry Count:", this.state.retryCount);
    console.groupEnd();
  }

  handleRetry = (): void => {
    if (this.state.retryCount >= (this.props.maxRetries || 3)) {
      );
      return;
    }

    this.setState((prevState) => ({
      isRetrying: true,
      retryCount: prevState.retryCount + 1,
    }));

    // Add delay before retry to allow state to settle
    this.retryTimeout = setTimeout(
      () => {
        this.setState({
          hasError: false,
          error: undefined,
          errorInfo: undefined,
          errorId: undefined,
          isRetrying: false,
        });
      },
      1000 + this.state.retryCount * 500,
    ); // Progressive delay
  };

  handleGoBack = (): void => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  handleReload = (): void => {
    window.location.reload();
  };

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default section error UI
      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mb-4 flex items-center justify-center">
                <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-900/20">
                  <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <CardTitle className="text-xl text-gray-900 dark:text-white">
                {this.props.sectionName} Unavailable
              </CardTitle>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                This section encountered an error and couldn't load properly.
                Our team has been notified and is working on a fix.
              </p>

              {this.state.errorId && (
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-500">
                  Error ID:{" "}
                  <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">
                    {this.state.errorId}
                  </code>
                </div>
              )}
            </CardHeader>

            <CardContent>
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
                            <pre className="max-h-32 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {this.state.error.stack}
                            </pre>
                          </div>
                        )}

                        {this.state.errorInfo?.componentStack && (
                          <div>
                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                              Component Stack
                            </h4>
                            <pre className="max-h-32 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
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
                {this.props.enableRetry &&
                  this.state.retryCount < (this.props.maxRetries || 3) && (
                    <Button
                      onClick={this.handleRetry}
                      disabled={this.state.isRetrying}
                      variant="default"
                      className="flex items-center justify-center"
                    >
                      <RefreshCw
                        className={`mr-2 h-4 w-4 ${this.state.isRetrying ? "animate-spin" : ""}`}
                      />
                      {this.state.isRetrying ? "Retrying..." : "Try Again"}
                    </Button>
                  )}

                <Button
                  onClick={this.handleGoBack}
                  variant="outline"
                  className="flex items-center justify-center"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>

                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  className="flex items-center justify-center"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
              </div>

              {/* Retry Information */}
              {this.state.retryCount > 0 && (
                <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Retry attempt: {this.state.retryCount} /{" "}
                  {this.props.maxRetries}
                </div>
              )}

              {/* Additional Help */}
              <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-600">
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                  <p className="mb-2">
                    If this problem persists, please contact our support team.
                  </p>
                  <div className="flex justify-center space-x-4 text-xs">
                    <button
                      onClick={() =>
                        window.open(
                          "mailto:support@readysetcorp.com?subject=Section Error&body=" +
                            encodeURIComponent(
                              `Section: ${this.props.sectionName}\nError ID: ${this.state.errorId}\n\nDescription: `,
                            ),
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
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SectionErrorBoundary;
