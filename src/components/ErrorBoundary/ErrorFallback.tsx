// src/components/ErrorBoundary/ErrorFallback.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Bug,
  MessageCircle,
} from "lucide-react";

interface ErrorFallbackProps {
  error?: Error;
  onRetry?: () => void;
  onGoHome?: () => void;
  onReload?: () => void;
  showDetails?: boolean;
  errorId?: string;
  title?: string;
  message?: string;
  retryCount?: number;
  maxRetries?: number;
  showContactOptions?: boolean;
}

/**
 * Generic error fallback component for unknown or unhandled errors
 * Provides comprehensive error display and recovery options
 */
export function ErrorFallback({
  error,
  onRetry,
  onGoHome,
  onReload,
  showDetails = false,
  errorId,
  title = "Something went wrong",
  message = "An unexpected error occurred. Our team has been notified and is working on a fix.",
  retryCount = 0,
  maxRetries = 3,
  showContactOptions = true,
}: ErrorFallbackProps) {
  const handleReload = () => {
    if (onReload) {
      onReload();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = "/";
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-xl text-gray-900 dark:text-white">
            {title}
          </CardTitle>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{message}</p>

          {errorId && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-500">
              Error ID:{" "}
              <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">
                {errorId}
              </code>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Error Details (Development/Debug Mode) */}
          {showDetails && error && (
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
                      {error.message}
                    </p>
                  </div>

                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                      Error Type
                    </h4>
                    <p className="rounded bg-orange-50 p-2 text-sm text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                      {error.name || "Unknown Error Type"}
                    </p>
                  </div>

                  {error.stack && (
                    <div>
                      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                        Stack Trace
                      </h4>
                      <pre className="max-h-32 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {onRetry && retryCount < maxRetries && (
              <Button
                onClick={handleRetry}
                variant="default"
                className="flex items-center justify-center"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}

            <Button
              onClick={handleReload}
              variant="outline"
              className="flex items-center justify-center"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Page
            </Button>

            <Button
              onClick={handleGoHome}
              variant="outline"
              className="flex items-center justify-center"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>

          {/* Retry Information */}
          {retryCount > 0 && (
            <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Retry attempt: {retryCount} / {maxRetries}
            </div>
          )}

          {/* Additional Information */}
          <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="flex items-start text-blue-800 dark:text-blue-200">
              <MessageCircle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="text-sm">
                <p className="mb-1 font-medium">What can you do?</p>
                <ul className="ml-4 list-disc space-y-1 text-xs">
                  <li>
                    Try refreshing the page or going back to the home page
                  </li>
                  <li>Clear your browser cache if the problem persists</li>
                  <li>
                    Contact our support team if you need immediate assistance
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact Options */}
          {showContactOptions && (
            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-600">
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                <p className="mb-2">
                  If this problem persists, please contact our support team.
                </p>
                <div className="flex justify-center space-x-4 text-xs">
                  <button
                    onClick={() =>
                      window.open(
                        "mailto:support@readysetcorp.com?subject=Application Error&body=" +
                          encodeURIComponent(
                            `Error ID: ${errorId}\nError: ${error?.message || "Unknown"}\n\nPlease describe what you were doing when this error occurred:\n`,
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ErrorFallback;
