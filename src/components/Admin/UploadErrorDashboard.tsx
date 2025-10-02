// src/components/Admin/UploadErrorDashboard.tsx
import React, { useState, useEffect, useCallback } from "react";
import { UploadErrorType } from "@/types/upload";

interface UploadError {
  id: string;
  correlationId: string;
  errorType: UploadErrorType;
  message: string;
  userMessage: string;
  details?: any;
  userId?: string;
  timestamp: string;
  retryable: boolean;
  resolved: boolean;
}

interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<UploadErrorType, number>;
  retryableErrors: number;
  resolvedErrors: number;
  recentErrors: number;
}

export function UploadErrorDashboard() {
  const [errors, setErrors] = useState<UploadError[]>([]);
  const [stats, setStats] = useState<ErrorStats>({
    totalErrors: 0,
    errorsByType: {} as Record<UploadErrorType, number>,
    retryableErrors: 0,
    resolvedErrors: 0,
    recentErrors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<UploadError | null>(null);
  const [filter, setFilter] = useState<{
    errorType?: UploadErrorType;
    retryable?: boolean;
    resolved?: boolean;
    dateRange?: string;
  }>({});

  const calculateStats = useCallback((errorList: UploadError[]) => {
    const stats: ErrorStats = {
      totalErrors: errorList.length,
      errorsByType: {} as Record<UploadErrorType, number>,
      retryableErrors: 0,
      resolvedErrors: 0,
      recentErrors: 0,
    };

    // Count errors by type
    Object.values(UploadErrorType).forEach((type) => {
      stats.errorsByType[type] = errorList.filter(
        (e) => e.errorType === type,
      ).length;
    });

    // Count retryable and resolved errors
    stats.retryableErrors = errorList.filter((e) => e.retryable).length;
    stats.resolvedErrors = errorList.filter((e) => e.resolved).length;

    // Count recent errors (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    stats.recentErrors = errorList.filter(
      (e) => new Date(e.timestamp) > oneDayAgo,
    ).length;

    setStats(stats);
  }, []);

  const fetchErrors = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filter.errorType) params.append("errorType", filter.errorType);
      if (filter.retryable !== undefined)
        params.append("retryable", filter.retryable.toString());
      if (filter.resolved !== undefined)
        params.append("resolved", filter.resolved.toString());
      if (filter.dateRange) params.append("dateRange", filter.dateRange);

      const response = await fetch(`/api/admin/upload-errors?${params}`);
      const data = await response.json();

      if (data.success) {
        setErrors(data.errors);
        calculateStats(data.errors);
      }
    } catch (error) {
      console.error("Failed to fetch upload errors:", error);
    } finally {
      setLoading(false);
    }
  }, [filter, calculateStats]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const resolveError = async (errorId: string) => {
    try {
      const response = await fetch(
        `/api/admin/upload-errors/${errorId}/resolve`,
        {
          method: "PUT",
        },
      );

      if (response.ok) {
        setErrors((prev) =>
          prev.map((error) =>
            error.id === errorId ? { ...error, resolved: true } : error,
          ),
        );
        calculateStats(
          errors.map((error) =>
            error.id === errorId ? { ...error, resolved: true } : error,
          ),
        );
      }
    } catch (error) {
      console.error("Failed to resolve error:", error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getErrorTypeColor = (errorType: UploadErrorType) => {
    const colors = {
      [UploadErrorType.NETWORK_ERROR]: "bg-yellow-100 text-yellow-800",
      [UploadErrorType.VALIDATION_ERROR]: "bg-red-100 text-red-800",
      [UploadErrorType.STORAGE_ERROR]: "bg-orange-100 text-orange-800",
      [UploadErrorType.PERMISSION_ERROR]: "bg-purple-100 text-purple-800",
      [UploadErrorType.QUOTA_ERROR]: "bg-pink-100 text-pink-800",
      [UploadErrorType.VIRUS_ERROR]: "bg-red-200 text-red-900",
      [UploadErrorType.SIZE_ERROR]: "bg-blue-100 text-blue-800",
      [UploadErrorType.TYPE_ERROR]: "bg-indigo-100 text-indigo-800",
      [UploadErrorType.UNKNOWN_ERROR]: "bg-gray-100 text-gray-800",
    };
    return colors[errorType] || colors[UploadErrorType.UNKNOWN_ERROR];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Upload Error Dashboard
        </h1>
        <button
          onClick={fetchErrors}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="rounded-lg bg-red-100 p-2">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Errors</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.totalErrors}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="rounded-lg bg-yellow-100 p-2">
              <svg
                className="h-6 w-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Retryable</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.retryableErrors}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="rounded-lg bg-green-100 p-2">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Resolved</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.resolvedErrors}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="rounded-lg bg-blue-100 p-2">
              <svg
                className="h-6 w-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Recent (24h)</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.recentErrors}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Type Breakdown */}
      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">Error Types</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {Object.entries(stats.errorsByType).map(([type, count]) => (
              <div key={type} className="text-center">
                <div
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getErrorTypeColor(type as UploadErrorType)}`}
                >
                  {count}
                </div>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {type.replace("_", " ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <select
              value={filter.errorType || ""}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  errorType: (e.target.value as UploadErrorType) || undefined,
                }))
              }
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">All Types</option>
              {Object.values(UploadErrorType).map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>

            <select
              value={filter.retryable?.toString() || ""}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  retryable: e.target.value
                    ? e.target.value === "true"
                    : undefined,
                }))
              }
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">All Errors</option>
              <option value="true">Retryable</option>
              <option value="false">Non-retryable</option>
            </select>

            <select
              value={filter.resolved?.toString() || ""}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  resolved: e.target.value
                    ? e.target.value === "true"
                    : undefined,
                }))
              }
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="true">Resolved</option>
              <option value="false">Unresolved</option>
            </select>

            <select
              value={filter.dateRange || ""}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  dateRange: e.target.value || undefined,
                }))
              }
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">All Time</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error List */}
      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">Recent Errors</h3>
        </div>
        <div className="overflow-hidden">
          {loading ? (
            <div className="p-6 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-500">Loading errors...</p>
            </div>
          ) : errors.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500">No errors found</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className="border-b border-gray-200 p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getErrorTypeColor(error.errorType)}`}
                        >
                          {error.errorType.replace("_", " ")}
                        </span>
                        {error.retryable && (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            Retryable
                          </span>
                        )}
                        {error.resolved && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                            Resolved
                          </span>
                        )}
                      </div>
                      <p className="mb-1 text-sm font-medium text-gray-900">
                        {error.userMessage}
                      </p>
                      <p className="mb-2 text-xs text-gray-500">
                        {formatTimestamp(error.timestamp)}
                      </p>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                          Technical Details
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded bg-gray-100 p-2 text-xs">
                          {JSON.stringify(error.details, null, 2)}
                        </pre>
                      </details>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedError(error)}
                        className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                      >
                        View
                      </button>
                      {!error.resolved && (
                        <button
                          onClick={() => resolveError(error.id)}
                          className="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error Details Modal */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 max-h-96 w-full max-w-2xl overflow-y-auto rounded-lg bg-white">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Error Details
                </h3>
                <button
                  onClick={() => setSelectedError(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Correlation ID
                  </label>
                  <p className="rounded bg-gray-100 p-2 font-mono text-sm text-gray-900">
                    {selectedError.correlationId}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Error Type
                  </label>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${getErrorTypeColor(selectedError.errorType)}`}
                  >
                    {selectedError.errorType.replace("_", " ")}
                  </span>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    User Message
                  </label>
                  <p className="text-sm text-gray-900">
                    {selectedError.userMessage}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Technical Message
                  </label>
                  <p className="rounded bg-gray-100 p-2 font-mono text-sm text-gray-900">
                    {selectedError.message}
                  </p>
                </div>

                {selectedError.details && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Additional Details
                    </label>
                    <pre className="overflow-x-auto rounded bg-gray-100 p-3 text-sm">
                      {JSON.stringify(selectedError.details, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Timestamp
                  </label>
                  <p className="text-sm text-gray-900">
                    {formatTimestamp(selectedError.timestamp)}
                  </p>
                </div>

                <div className="flex items-center space-x-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${
                      selectedError.retryable
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedError.retryable ? "Retryable" : "Non-retryable"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${
                      selectedError.resolved
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {selectedError.resolved ? "Resolved" : "Unresolved"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
