'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
  Package,
  Truck,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Activity,
} from 'lucide-react';
import { useDriverStats } from '@/hooks/tracking/useDriverStats';
import type { StatsPeriod } from '@/services/tracking/driver-stats';

interface DriverStatsCardProps {
  driverId: string;
  defaultPeriod?: StatsPeriod;
  compact?: boolean;
  showTrends?: boolean;
  className?: string;
}

/**
 * Displays aggregated driver statistics with period selector
 */
export function DriverStatsCard({
  driverId,
  defaultPeriod = 'today',
  compact = false,
  showTrends = true,
  className = '',
}: DriverStatsCardProps) {
  const [period, setPeriod] = React.useState<StatsPeriod>(defaultPeriod);

  const { data: stats, isLoading, error, isFetching } = useDriverStats({
    driverId,
    period,
  });

  const handlePeriodChange = (value: string) => {
    setPeriod(value as StatsPeriod);
  };

  if (error) {
    return (
      <Card className={`shadow-sm ${className}`}>
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            <p>Unable to load statistics</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`shadow-sm ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium">
              Performance Stats
              {isFetching && !isLoading && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </CardTitle>
            {!compact && (
              <CardDescription className="mt-1">
                Your delivery performance metrics
              </CardDescription>
            )}
          </div>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <StatsLoadingSkeleton compact={compact} />
        ) : stats ? (
          <div className={compact ? 'space-y-4' : 'space-y-6'}>
            {/* Delivery Stats */}
            <div className="grid grid-cols-2 gap-4">
              <StatItem
                icon={<Package className="h-5 w-5 text-blue-500" />}
                label="Deliveries"
                value={stats.deliveryStats.total}
                subValue={`${stats.deliveryStats.completed} completed`}
                compact={compact}
              />
              <StatItem
                icon={<Truck className="h-5 w-5 text-green-500" />}
                label="In Progress"
                value={stats.deliveryStats.inProgress}
                compact={compact}
              />
            </div>

            {/* Distance Stats */}
            <div className="grid grid-cols-2 gap-4">
              <StatItem
                icon={<MapPin className="h-5 w-5 text-purple-500" />}
                label="Miles Driven"
                value={stats.distanceStats.totalMiles}
                subValue={`${stats.distanceStats.averageMilesPerDelivery} avg/delivery`}
                compact={compact}
              />
              <StatItem
                icon={<Clock className="h-5 w-5 text-orange-500" />}
                label="Hours Worked"
                value={stats.shiftStats.totalHoursWorked}
                subValue={`${stats.shiftStats.totalShifts} shifts`}
                compact={compact}
              />
            </div>

            {/* Current Shift (if active) */}
            {stats.currentShift && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Active Shift
                    </span>
                  </div>
                  {stats.currentShift.isOnBreak && (
                    <Badge variant="secondary" className="text-xs">
                      On Break
                    </Badge>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-blue-700 dark:text-blue-300">
                    <span className="font-medium">{stats.currentShift.currentDeliveries}</span> deliveries
                  </div>
                  <div className="text-blue-700 dark:text-blue-300">
                    <span className="font-medium">{stats.currentShift.currentMiles}</span> miles
                  </div>
                </div>
              </div>
            )}

            {/* Trends (week/month only) */}
            {showTrends && stats.trends && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground mb-2">
                  Compared to previous {period === 'week' ? 'week' : 'month'}
                </div>
                <div className="flex items-center gap-4">
                  <TrendBadge
                    label="Deliveries"
                    value={stats.trends.deliveryChange}
                  />
                  <TrendBadge
                    label="Distance"
                    value={stats.trends.distanceChange}
                  />
                  <div className="text-xs text-muted-foreground">
                    {stats.trends.efficiencyRating} deliveries/hr
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subValue?: string;
  compact?: boolean;
}

function StatItem({ icon, label, value, subValue, compact }: StatItemProps) {
  return (
    <div className="flex items-start space-x-3">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className={compact ? 'text-lg font-semibold' : 'text-2xl font-bold'}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {subValue && (
          <div className="text-xs text-muted-foreground mt-0.5">{subValue}</div>
        )}
      </div>
    </div>
  );
}

interface TrendBadgeProps {
  label: string;
  value: number;
}

function TrendBadge({ label, value }: TrendBadgeProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <div className="flex items-center gap-1">
      {!isNeutral && (
        isPositive ? (
          <TrendingUp className="h-3 w-3 text-green-600" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-600" />
        )
      )}
      <span
        className={`text-xs font-medium ${
          isNeutral
            ? 'text-muted-foreground'
            : isPositive
            ? 'text-green-600'
            : 'text-red-600'
        }`}
      >
        {isPositive ? '+' : ''}{value}% {label.toLowerCase()}
      </span>
    </div>
  );
}

interface StatsLoadingSkeletonProps {
  compact?: boolean;
}

function StatsLoadingSkeleton({ compact }: StatsLoadingSkeletonProps) {
  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start space-x-3">
          <Skeleton className="h-5 w-5 rounded" />
          <div>
            <Skeleton className={compact ? 'h-6 w-16' : 'h-8 w-20'} />
            <Skeleton className="h-3 w-12 mt-1" />
          </div>
        </div>
        <div className="flex items-start space-x-3">
          <Skeleton className="h-5 w-5 rounded" />
          <div>
            <Skeleton className={compact ? 'h-6 w-16' : 'h-8 w-20'} />
            <Skeleton className="h-3 w-12 mt-1" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-start space-x-3">
          <Skeleton className="h-5 w-5 rounded" />
          <div>
            <Skeleton className={compact ? 'h-6 w-16' : 'h-8 w-20'} />
            <Skeleton className="h-3 w-12 mt-1" />
          </div>
        </div>
        <div className="flex items-start space-x-3">
          <Skeleton className="h-5 w-5 rounded" />
          <div>
            <Skeleton className={compact ? 'h-6 w-16' : 'h-8 w-20'} />
            <Skeleton className="h-3 w-12 mt-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DriverStatsCard;
