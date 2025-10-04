// src/components/AddressManager/AddressCardSkeleton.tsx

import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader component that matches the AddressCard layout
 * Provides visual feedback during data loading
 */
const AddressCardSkeleton: React.FC = () => {
  return (
    <Card className="border-l-4 border-l-gray-300">
      <CardHeader className="space-y-3 pb-4">
        {/* Title and action buttons skeleton */}
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-6 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        {/* Badges skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Address skeleton */}
        <div className="flex items-start gap-2">
          <Skeleton className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>

        {/* Metadata skeleton */}
        <div className="flex gap-4 border-t border-gray-200 pt-3 dark:border-gray-700">
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Phone skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 flex-shrink-0" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  );
};

export default AddressCardSkeleton;
