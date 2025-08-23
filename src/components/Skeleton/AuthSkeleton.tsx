// src/components/Skeleton/AuthSkeleton.tsx
"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div
    className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`}
  />
);

interface AuthSkeletonProps {
  sticky?: boolean;
  isVirtualAssistantPage?: boolean;
  isHomePage?: boolean;
  isLogisticsPage?: boolean;
}

export const AuthButtonsSkeleton: React.FC<AuthSkeletonProps> = ({
  sticky = false,
  isVirtualAssistantPage = false,
  isHomePage = false,
  isLogisticsPage = false,
}) => {
  return (
    <div className="flex items-center gap-3">
      {/* Dashboard Link Skeleton */}
      <div
        className={`rounded-lg px-7 py-3 transition-all duration-300 ${
          sticky
            ? "bg-gray-100 dark:bg-gray-800"
            : isVirtualAssistantPage || isHomePage || isLogisticsPage
              ? "bg-white/10"
              : "bg-gray-100 dark:bg-gray-800"
        }`}
      >
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Sign Out Button Skeleton */}
      <div
        className={`rounded-lg px-6 py-3 ${
          isVirtualAssistantPage || isHomePage
            ? "bg-blue-800/20"
            : "bg-blue-800"
        }`}
      >
        <Skeleton className="h-4 w-16 bg-white/30" />
      </div>
    </div>
  );
};

export const UserProfileSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 px-4 py-2">
    <Skeleton className="h-10 w-10 rounded-full" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  </div>
);

export const DashboardCardSkeleton: React.FC = () => (
  <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
    <div className="flex items-center">
      <Skeleton className="mr-4 h-12 w-12 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-12" />
      </div>
    </div>
  </div>
);

export const OrderCardSkeleton: React.FC = () => (
  <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-start justify-between">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>

    <div className="space-y-2">
      <div className="flex items-center">
        <Skeleton className="mr-1.5 h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex items-center">
        <Skeleton className="mr-1.5 h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex items-center">
        <Skeleton className="mr-1.5 h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>

    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-20" />
    </div>
  </div>
);

export const QuickActionsSkeleton: React.FC = () => (
  <div className="space-y-4">
    {[1, 2, 3, 4].map((index) => (
      <div
        key={index}
        className="flex items-center rounded-lg border border-gray-100 p-3"
      >
        <Skeleton className="mr-3 h-9 w-9 rounded-md" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    ))}
  </div>
);

export const LoadingSpinner: React.FC<{
  size?: "sm" | "md" | "lg";
  className?: string;
}> = ({ size = "md", className = "" }) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className={`animate-spin ${sizeClasses[size]} ${className}`}>
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

interface LoadingStateProps {
  message?: string;
  showSpinner?: boolean;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading...",
  showSpinner = true,
  className = "",
}) => (
  <div className={`flex items-center gap-2 ${className}`}>
    {showSpinner && <LoadingSpinner size="sm" />}
    <span className="text-sm">{message}</span>
  </div>
);

export default {
  AuthButtonsSkeleton,
  UserProfileSkeleton,
  DashboardCardSkeleton,
  OrderCardSkeleton,
  QuickActionsSkeleton,
  LoadingSpinner,
  LoadingState,
};
