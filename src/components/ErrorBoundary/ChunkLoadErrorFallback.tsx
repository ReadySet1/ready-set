// src/components/ErrorBoundary/ChunkLoadErrorFallback.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Download, Zap, Clock } from "lucide-react";

interface ChunkLoadErrorFallbackProps {
  error?: Error;
  onRetry?: () => void;
  onGoHome?: () => void;
  showDetails?: boolean;
  errorId?: string;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Specialized fallback UI for chunk loading errors (code splitting failures)
 * Provides chunk-specific recovery options and cache clearing
 */
export function ChunkLoadErrorFallback({
  error,
  onRetry,
  onGoHome,
  showDetails = false,
  errorId,
  retryCount = 0,
  maxRetries = 3,
}: ChunkLoadErrorFallbackProps) {
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);

  const isChunkError =
    error?.message?.toLowerCase().includes("chunk") ||
    error?.message?.toLowerCase().includes("loading") ||
    error?.message?.toLowerCase().includes("script") ||
    error?.name === "ChunkLoadError";

  const clearAppCache = async () => {
    setIsClearingCache(true);

    try {
      // Clear service worker caches if available
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        );
      }

      // Clear local storage (except essential data)
      const essentialKeys = ["user", "session", "theme", "preferences"];
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !essentialKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // Clear session storage
      sessionStorage.clear();

      setCacheCleared(true);

      // Reload after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (clearError) {
      console.error("Error clearing cache:", clearError);
      // Fallback to simple reload
      window.location.reload();
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-full bg-purple-100 p-4 dark:bg-purple-900/20">
              <Download className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <CardTitle className="text-xl text-gray-900 dark:text-white">
            Loading Error
          </CardTitle>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            There was a problem loading some application resources. This might
            be due to a browser cache issue or a recent update.
          </p>

          {errorId && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-500">
              Error ID:{" "}
              <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">
                {errorId}
              </code>
            </div>
          )}

          {cacheCleared && (
            <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
              <div className="flex items-center text-green-800 dark:text-green-200">
                <Zap className="mr-2 h-4 w-4" />
                <span className="text-sm font-medium">
                  Cache cleared successfully!
                </span>
              </div>
              <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                Reloading the page now...
              </p>
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

                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                      Error Type
                    </h4>
                    <p className="rounded bg-purple-50 p-2 text-sm text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                      {isChunkError
                        ? "Chunk Loading Error"
                        : error.name || "Unknown Error Type"}
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
            <Button
              onClick={clearAppCache}
              disabled={isClearingCache}
              variant="default"
              className="flex items-center justify-center"
            >
              {isClearingCache ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Clearing Cache...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Clear Cache & Reload
                </>
              )}
            </Button>

            {onRetry && retryCount < maxRetries && (
              <Button
                onClick={onRetry}
                variant="outline"
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
              <AlertTriangle className="mr-2 mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="text-sm">
                <p className="mb-1 font-medium">What happened?</p>
                <p className="text-xs">
                  This error usually occurs when there's a problem loading
                  updated application code. Clearing your browser cache and
                  reloading the page should resolve the issue.
                </p>
              </div>
            </div>
          </div>

          {/* Additional Help */}
          <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-600">
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <p className="mb-2">
                If this problem persists after clearing cache, please contact
                our support team.
              </p>
              <div className="flex justify-center space-x-4 text-xs">
                <button
                  onClick={() =>
                    window.open(
                      "mailto:support@readysetcorp.com?subject=Loading Error&body=" +
                        encodeURIComponent(
                          `Error ID: ${errorId}\nError Type: Chunk Loading Error\nError: ${error?.message || "Unknown"}\n\nDescription: `,
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

export default ChunkLoadErrorFallback;
