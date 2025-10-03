// src/components/ErrorBoundary/NetworkErrorFallback.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Globe,
  Server,
} from "lucide-react";

interface NetworkErrorFallbackProps {
  error?: Error;
  onRetry?: () => void;
  onGoHome?: () => void;
  showDetails?: boolean;
  errorId?: string;
  isOnline?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Specialized fallback UI for network-related errors
 * Provides network-specific context and recovery options
 */
export function NetworkErrorFallback({
  error,
  onRetry,
  onGoHome,
  showDetails = false,
  errorId,
  isOnline = navigator?.onLine ?? true,
  retryCount = 0,
  maxRetries = 3,
}: NetworkErrorFallbackProps) {
  const isNetworkError =
    error?.message?.toLowerCase().includes("network") ||
    error?.message?.toLowerCase().includes("fetch") ||
    error?.message?.toLowerCase().includes("connection") ||
    error?.message?.toLowerCase().includes("timeout") ||
    !isOnline;

  const getErrorIcon = () => {
    if (!isOnline)
      return <WifiOff className="h-8 w-8 text-red-600 dark:text-red-400" />;
    return <Server className="h-8 w-8 text-orange-600 dark:text-orange-400" />;
  };

  const getErrorTitle = () => {
    if (!isOnline) return "No Internet Connection";
    return "Connection Problem";
  };

  const getErrorMessage = () => {
    if (!isOnline) {
      return "Please check your internet connection and try again.";
    }
    return "We're having trouble connecting to our servers. This might be a temporary issue.";
  };

  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex items-center justify-center">
            <div
              className={`rounded-full p-4 ${!isOnline ? "bg-red-100 dark:bg-red-900/20" : "bg-orange-100 dark:bg-orange-900/20"}`}
            >
              {getErrorIcon()}
            </div>
          </div>
          <CardTitle className="text-xl text-gray-900 dark:text-white">
            {getErrorTitle()}
          </CardTitle>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {getErrorMessage()}
          </p>

          {errorId && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-500">
              Error ID:{" "}
              <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">
                {errorId}
              </code>
            </div>
          )}

          {!isOnline && (
            <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
              <div className="flex items-center text-yellow-800 dark:text-yellow-200">
                <Wifi className="mr-2 h-4 w-4" />
                <span className="text-sm font-medium">Connection Tips</span>
              </div>
              <ul className="ml-6 mt-2 space-y-1 text-xs text-yellow-700 dark:text-yellow-300">
                <li>• Check your Wi-Fi or mobile data connection</li>
                <li>• Try refreshing the page</li>
                <li>
                  • Contact your network administrator if the problem persists
                </li>
              </ul>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Error Details (Development/Debug Mode) */}
          {showDetails && error && (
            <div className="mb-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-700">
              <details className="cursor-pointer">
                <summary className="mb-2 flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                  <AlertTriangle className="mr-2 h-4 w-4" />
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
                onClick={onRetry}
                variant="default"
                className="flex items-center justify-center"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}

            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="flex items-center justify-center"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Page
            </Button>

            {onGoHome && (
              <Button
                onClick={onGoHome}
                variant="outline"
                className="flex items-center justify-center"
              >
                <Globe className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            )}
          </div>

          {/* Retry Information */}
          {retryCount > 0 && (
            <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Retry attempt: {retryCount} / {maxRetries}
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
                      "mailto:support@readysetcorp.com?subject=Network Error&body=" +
                        encodeURIComponent(
                          `Error ID: ${errorId}\nNetwork Status: ${isOnline ? "Online" : "Offline"}\nError: ${error?.message || "Unknown"}\n\nDescription: `,
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

export default NetworkErrorFallback;
