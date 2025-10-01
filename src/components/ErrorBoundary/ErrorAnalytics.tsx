// src/components/ErrorBoundary/ErrorAnalytics.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getErrorMetrics,
  getRecentErrors,
  getErrorsByCategory,
  getErrorsBySeverity,
  ErrorSeverity,
  ErrorCategory,
  StructuredError,
} from "@/lib/error-logging";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  Filter,
  RefreshCw,
  Download,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";

interface ErrorAnalyticsProps {
  className?: string;
  showDebugInfo?: boolean;
}

/**
 * Error analytics dashboard component for monitoring error trends and patterns
 */
export function ErrorAnalytics({
  className,
  showDebugInfo = false,
}: ErrorAnalyticsProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [recentErrors, setRecentErrors] = useState<StructuredError[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<
    ErrorCategory | "all"
  >("all");
  const [selectedSeverity, setSelectedSeverity] = useState<
    ErrorSeverity | "all"
  >("all");
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = () => {
    setIsLoading(true);

    try {
      const errorMetrics = getErrorMetrics();
      const recent = getRecentErrors(50);

      setMetrics(errorMetrics);
      setRecentErrors(recent);
    } catch (error) {
      console.error("Failed to load error analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();

    // Auto-refresh every 30 seconds in development
    if (process.env.NODE_ENV === "development") {
      const interval = setInterval(refreshData, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  const filteredErrors = recentErrors.filter((error) => {
    if (selectedCategory !== "all" && error.category !== selectedCategory)
      return false;
    if (selectedSeverity !== "all" && error.severity !== selectedSeverity)
      return false;
    return true;
  });

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case ErrorSeverity.HIGH:
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case ErrorSeverity.MEDIUM:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case ErrorSeverity.LOW:
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadgeVariant = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return "destructive";
      case ErrorSeverity.HIGH:
        return "secondary";
      case ErrorSeverity.MEDIUM:
        return "outline";
      case ErrorSeverity.LOW:
        return "outline";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
          <span>Loading error analytics...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-2 h-5 w-5" />
            Error Analytics
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recent">Recent Errors</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {metrics && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-gray-50 p-4 text-center dark:bg-gray-800">
                  <div className="text-2xl font-bold text-red-600">
                    {metrics.totalErrors}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Total Errors
                  </div>
                </div>

                <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20">
                  <div className="text-2xl font-bold text-red-600">
                    {metrics.errorsBySeverity[ErrorSeverity.CRITICAL] || 0}
                  </div>
                  <div className="text-sm text-red-600">Critical</div>
                </div>

                <div className="rounded-lg bg-orange-50 p-4 text-center dark:bg-orange-900/20">
                  <div className="text-2xl font-bold text-orange-600">
                    {metrics.errorsBySeverity[ErrorSeverity.HIGH] || 0}
                  </div>
                  <div className="text-sm text-orange-600">High</div>
                </div>

                <div className="rounded-lg bg-yellow-50 p-4 text-center dark:bg-yellow-900/20">
                  <div className="text-2xl font-bold text-yellow-600">
                    {(metrics.errorsBySeverity[ErrorSeverity.MEDIUM] || 0) +
                      (metrics.errorsBySeverity[ErrorSeverity.LOW] || 0)}
                  </div>
                  <div className="text-sm text-yellow-600">Medium/Low</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 font-semibold">Errors by Category</h4>
                <div className="space-y-2">
                  {metrics?.errorsByCategory &&
                    Object.entries(metrics.errorsByCategory).map(
                      ([category, count]) => (
                        <div
                          key={category}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm capitalize">
                            {category.replace("_", " ")}
                          </span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ),
                    )}
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-semibold">Top Error Patterns</h4>
                <div className="space-y-2">
                  {metrics?.topErrors
                    ?.slice(0, 5)
                    .map((error: any, index: number) => (
                      <div
                        key={error.fingerprint}
                        className="flex items-center justify-between"
                      >
                        <span className="mr-2 flex-1 truncate text-sm">
                          {error.fingerprint.substring(0, 20)}...
                        </span>
                        <Badge variant="secondary">{error.count}</Badge>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recent" className="space-y-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
              >
                All Categories
              </Button>
              {Object.values(ErrorCategory).map((category) => (
                <Button
                  key={category}
                  variant={
                    selectedCategory === category ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="capitalize"
                >
                  {category.replace("_", " ")}
                </Button>
              ))}
            </div>

            <div className="max-h-96 space-y-2 overflow-y-auto">
              {filteredErrors.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <CheckCircle className="mx-auto mb-2 h-12 w-12 text-green-500" />
                  <p>No errors found matching the current filters</p>
                </div>
              ) : (
                filteredErrors.map((error, index) => (
                  <div
                    key={`${error.id}-${index}`}
                    className="rounded-lg border bg-gray-50 p-3 dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center space-x-2">
                          {getSeverityIcon(error.severity)}
                          <span className="text-sm font-medium">
                            {error.message}
                          </span>
                          <Badge
                            variant={getSeverityBadgeVariant(error.severity)}
                          >
                            {error.severity}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {error.category.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {new Date(error.timestamp).toLocaleString()} •
                          {error.context.component?.name &&
                            ` Component: ${error.context.component.name}`}
                          {error.context.route?.path &&
                            ` • Route: ${error.context.route.path}`}
                        </div>
                      </div>
                      {showDebugInfo && (
                        <Button variant="ghost" size="sm">
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <div className="py-8 text-center">
              <TrendingUp className="mx-auto mb-2 h-12 w-12 text-blue-500" />
              <p className="text-gray-500">Trend analysis coming soon...</p>
              <p className="mt-2 text-sm text-gray-400">
                Error trends and patterns will be displayed here
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {showDebugInfo && process.env.NODE_ENV === "development" && (
          <div className="mt-6 border-t pt-4">
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                Debug Information
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-100 p-3 text-xs dark:bg-gray-800">
                {JSON.stringify(
                  { metrics, recentErrors: recentErrors.length },
                  null,
                  2,
                )}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ErrorAnalytics;
