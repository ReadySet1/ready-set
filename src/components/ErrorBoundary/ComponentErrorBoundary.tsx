// src/components/ErrorBoundary/ComponentErrorBoundary.tsx
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  createErrorBoundaryLogger,
  collectErrorContext,
} from "@/lib/error-logging";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Bug } from "lucide-react";

interface Props {
  children: ReactNode;
  componentName: string;
  fallback?: ReactNode;
  showDetails?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRetry?: boolean;
  maxRetries?: number;
  graceful?: boolean; // If true, shows inline error instead of full page replacement
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
 * Component-level error boundary for protecting individual components
 * Can render inline errors or replace component entirely based on graceful prop
 */
class ComponentErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;
  private errorLogger: (
    error: Error,
    errorInfo: any,
    additionalContext?: Record<string, any>,
  ) => void;

  static defaultProps = {
    enableRetry: true,
    maxRetries: 2,
    showDetails: false,
    graceful: false,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
      isRetrying: false,
    };

    // Initialize error logger for this component
    this.errorLogger = createErrorBoundaryLogger(
      props.componentName,
      "component",
    );
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `component_error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Collect comprehensive error context
    const errorContext = collectErrorContext({
      errorBoundary: {
        name: this.props.componentName,
        level: "component",
        retryCount: this.state.retryCount,
      },
    });

    // Log error with component context
    this.errorLogger(error, errorInfo, {
      componentName: this.props.componentName,
      retryCount: this.state.retryCount,
      errorContext,
    });

    // Update state to include errorInfo
    this.setState({ errorInfo });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Additional logging for debugging
    console.group(`🚨 Component Error Boundary: ${this.props.componentName}`);
    console.error("Error:", error);
    console.error("Error Info:", errorInfo);
    console.error("Component Stack:", errorInfo.componentStack);
    console.error("Retry Count:", this.state.retryCount);
    console.groupEnd();
  }

  handleRetry = (): void => {
    if (this.state.retryCount >= (this.props.maxRetries || 2)) {
      );
      return;
    }

    this.setState((prevState) => ({
      isRetrying: true,
      retryCount: prevState.retryCount + 1,
    }));

    // Add delay before retry
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
      500 + this.state.retryCount * 250,
    ); // Progressive delay
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

      // Graceful inline error (doesn't replace entire component)
      if (this.props.graceful) {
        return (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-4 dark:bg-orange-900/20">
            <div className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">
                {this.props.componentName} couldn't load properly
              </span>
            </div>
            {this.props.enableRetry &&
              this.state.retryCount < (this.props.maxRetries || 2) && (
                <Button
                  onClick={this.handleRetry}
                  disabled={this.state.isRetrying}
                  size="sm"
                  variant="outline"
                  className="mt-2 border-orange-300 text-orange-800 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-200 dark:hover:bg-orange-900/30"
                >
                  <RefreshCw
                    className={`mr-1 h-3 w-3 ${this.state.isRetrying ? "animate-spin" : ""}`}
                  />
                  {this.state.isRetrying ? "Retrying..." : "Retry"}
                </Button>
              )}
          </div>
        );
      }

      // Full component replacement error UI
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:bg-red-900/20">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Component Error
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                The <strong>{this.props.componentName}</strong> component
                encountered an error and couldn't render.
              </p>

              {this.state.errorId && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Error ID:{" "}
                  <code className="rounded bg-red-100 px-1 py-0.5 dark:bg-red-800">
                    {this.state.errorId}
                  </code>
                </div>
              )}

              {/* Error Details (Development/Debug Mode) */}
              {(this.props.showDetails ||
                process.env.NODE_ENV === "development") &&
                this.state.error && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-red-800 hover:text-red-600 dark:text-red-200 dark:hover:text-red-400">
                      <Bug className="mr-1 inline h-3 w-3" />
                      Error Details
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                          Error Message
                        </h4>
                        <p className="mt-1 rounded bg-red-100 p-2 text-xs text-red-600 dark:bg-red-800 dark:text-red-400">
                          {this.state.error.message}
                        </p>
                      </div>

                      {this.state.error.stack && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                            Stack Trace
                          </h4>
                          <pre className="mt-1 max-h-24 overflow-auto rounded bg-red-100 p-2 text-xs text-red-600 dark:bg-red-800 dark:text-red-400">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}

                      {this.state.errorInfo?.componentStack && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                            Component Stack
                          </h4>
                          <pre className="mt-1 max-h-24 overflow-auto rounded bg-red-100 p-2 text-xs text-red-600 dark:bg-red-800 dark:text-red-400">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}

              {/* Action Buttons */}
              <div className="mt-4 flex space-x-2">
                {this.props.enableRetry &&
                  this.state.retryCount < (this.props.maxRetries || 2) && (
                    <Button
                      onClick={this.handleRetry}
                      disabled={this.state.isRetrying}
                      size="sm"
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      <RefreshCw
                        className={`mr-1 h-3 w-3 ${this.state.isRetrying ? "animate-spin" : ""}`}
                      />
                      {this.state.isRetrying ? "Retrying..." : "Retry"}
                    </Button>
                  )}

                <Button
                  onClick={() => window.location.reload()}
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-600 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Reload Page
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ComponentErrorBoundary;
