'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Camera,
  Search,
  Calendar,
  User,
  MapPin,
  RefreshCw,
  Image as ImageIcon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProofOfDeliveryViewer } from '@/components/Driver/ProofOfDeliveryViewer';
import { PODGalleryItem, PODGalleryFilters, PODGalleryPagination } from '@/types/proof-of-delivery';

interface AdminPODGalleryProps {
  className?: string;
}

/**
 * AdminPODGallery Component
 *
 * Admin dashboard component for viewing all proof of delivery photos
 * with filtering, pagination, and lightbox viewing capabilities.
 */
export function AdminPODGallery({ className }: AdminPODGalleryProps) {
  const [filters, setFilters] = useState<PODGalleryFilters>({
    searchQuery: '',
  });
  const [pagination, setPagination] = useState<PODGalleryPagination>({
    page: 1,
    pageSize: 12,
    totalItems: 0,
    totalPages: 0,
  });

  // Fetch POD photos
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-pod-gallery', filters, pagination.page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      if (filters.searchQuery) {
        params.append('search', filters.searchQuery);
      }
      if (filters.driverId) {
        params.append('driverId', filters.driverId);
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo.toISOString());
      }

      const response = await fetch(`/api/tracking/deliveries/pod-gallery?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch POD gallery');
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });

  const podItems: PODGalleryItem[] = data?.items || [];
  const totalItems = data?.totalItems || 0;
  const totalPages = Math.ceil(totalItems / pagination.pageSize);

  /**
   * Handle search input change with debounce effect
   */
  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  /**
   * Format date for display
   */
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4">
        <Camera className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-medium">No Photos Found</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {filters.searchQuery
          ? 'Try adjusting your search or filters'
          : 'No proof of delivery photos have been uploaded yet'}
      </p>
    </div>
  );

  /**
   * Render loading skeleton
   */
  const renderSkeleton = () => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );

  /**
   * Render gallery grid
   */
  const renderGallery = () => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {podItems.map((item) => (
        <Card key={item.id} className="overflow-hidden">
          <div className="relative">
            <ProofOfDeliveryViewer
              photoUrl={item.photoUrl}
              deliveryId={item.deliveryId}
              orderNumber={item.orderNumber}
              capturedAt={new Date(item.capturedAt)}
              className="aspect-[4/3] w-full"
              showDownload={true}
              showLocation={false}
            />
            <Badge
              variant="secondary"
              className="absolute left-2 top-2 bg-black/60 text-white hover:bg-black/60"
            >
              {item.orderNumber}
            </Badge>
          </div>
          <CardContent className="p-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{item.driverName}</span>
              </div>
              {item.customerName && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="truncate">{item.customerName}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(item.capturedAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  /**
   * Render pagination controls
   */
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Showing {(pagination.page - 1) * pagination.pageSize + 1} -{' '}
          {Math.min(pagination.page * pagination.pageSize, totalItems)} of {totalItems}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Proof of Delivery Photos
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by order #, driver, or customer..."
              value={filters.searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filters.driverId || 'all'}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                driverId: value === 'all' ? undefined : value,
              }))
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Drivers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem>
              {/* Driver list would be populated from API */}
            </SelectContent>
          </Select>
        </div>

        {/* Stats summary */}
        {totalItems > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            <span>{totalItems} photos</span>
          </div>
        )}

        {/* Gallery content */}
        {isLoading ? (
          renderSkeleton()
        ) : podItems.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {renderGallery()}
            {renderPagination()}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminPODGallery;
