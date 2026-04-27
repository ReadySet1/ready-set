"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  NavigationIcon,
  MapPinIcon,
  ClockIcon,
  TruckIcon,
  PlayIcon,
  PauseIcon,
  PackageIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  UserIcon,
  HistoryIcon,
  LogOutIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DriverDeliveries from "@/components/Driver/DriverDeliveries";
import { DriverStatsCard } from "@/components/Driver/DriverStatsCard";
import { useDriverStats } from "@/hooks/tracking/useDriverStats";
import { useUser } from "@/contexts/UserContext";

interface ShiftStatus {
  isActive: boolean;
  startTime?: Date;
  duration?: string;
}

const DriverPage = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMounted, setIsMounted] = useState(false);
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus>({ isActive: false });
  const [driverName, setDriverName] = useState("Driver");
  const [driverId, setDriverId] = useState<string | null>(null);

  const { logout } = useUser();

  // Fetch driver stats for the quick summary
  const { data: stats } = useDriverStats({
    driverId: driverId || '',
    period: 'today',
    enabled: !!driverId,
  });

  // Ensure time-based UI only renders on the client to avoid SSR hydration mismatches
  useEffect(() => {
    setIsMounted(true);
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Calculate greeting based on current time - memoized to prevent unnecessary recalculations
  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }, [currentTime]);

  // Fetch driver profile and ID
  useEffect(() => {
    const fetchDriverInfo = async () => {
      try {
        // Fetch user profile to get driver info
        const profileResponse = await fetch('/api/profile');
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          setDriverName(profile.name || profile.firstName || 'Driver');

          // Fetch driver ID using the profile
          const driverResponse = await fetch('/api/tracking/drivers?limit=1');
          if (driverResponse.ok) {
            const driverData = await driverResponse.json();
            if (driverData.success && driverData.data?.length > 0) {
              // For drivers, the API returns their own driver record
              setDriverId(driverData.data[0].id);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching driver info:', error);
      }
    };

    fetchDriverInfo();
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-gray-900 dark:to-gray-800">
      {/* Mobile-optimized header */}
      <div className="bg-white dark:bg-gray-900 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                <TruckIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Driver Dashboard</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400" suppressHydrationWarning>
                  {isMounted ? formatDate(currentTime) : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900 dark:text-white" suppressHydrationWarning>
                  {isMounted ? formatTime(currentTime) : ''}
                </div>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${shiftStatus.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {shiftStatus.isActive ? 'On Shift' : 'Off Shift'}
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/driver/profile" className="flex items-center">
                      <UserIcon className="w-4 h-4 mr-2" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="text-red-600 dark:text-red-400"
                  >
                    <LogOutIcon className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Welcome Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white" suppressHydrationWarning>
                {isMounted ? `Good ${greeting}, ${driverName}!` : `Hello, ${driverName}!`}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">Ready to make some deliveries today?</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Start Shift / Tracking */}
          <Link href="/driver/tracking" className="block">
            <Card className="h-full border-2 border-transparent hover:border-amber-500 transition-all duration-200 bg-gradient-to-r from-amber-400 to-yellow-400 text-gray-900 hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {shiftStatus.isActive ? (
                        <PauseIcon className="w-6 h-6" />
                      ) : (
                        <PlayIcon className="w-6 h-6" />
                      )}
                      <h3 className="text-lg font-semibold">
                        {shiftStatus.isActive ? 'Manage Shift' : 'Start Shift'}
                      </h3>
                    </div>
                    <p className="text-gray-700 text-sm">
                      {shiftStatus.isActive
                        ? 'Track location & manage deliveries'
                        : 'Begin tracking your shift & location'
                      }
                    </p>
                    {shiftStatus.isActive && shiftStatus.duration && (
                      <div className="flex items-center space-x-1 text-gray-700">
                        <ClockIcon className="w-4 h-4" />
                        <span className="text-xs">Active for {shiftStatus.duration}</span>
                      </div>
                    )}
                  </div>
                  <NavigationIcon className="w-8 h-8 opacity-60" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* View Deliveries */}
          <Card className="h-full border-2 border-transparent hover:border-amber-400 transition-all duration-200 bg-gradient-to-r from-gray-800 to-gray-900 text-white hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <MapPinIcon className="w-6 h-6 text-amber-400" />
                    <h3 className="text-lg font-semibold">My Deliveries</h3>
                  </div>
                  <p className="text-gray-300 text-sm">
                    View today's delivery schedule
                  </p>
                  <div className="flex items-center space-x-4 text-amber-300">
                    <div className="flex items-center space-x-1">
                      <PackageIcon className="w-4 h-4" />
                      <span className="text-xs">
                        {stats?.deliveryStats.inProgress ?? 0} Pending
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CheckCircleIcon className="w-4 h-4" />
                      <span className="text-xs">
                        {stats?.deliveryStats.completed ?? 0} Complete
                      </span>
                    </div>
                  </div>
                </div>
                <MapPinIcon className="w-8 h-8 text-amber-400 opacity-60" />
              </div>
            </CardContent>
          </Card>

          {/* View History */}
          <Link href="/driver/history" className="block">
            <Card className="h-full border-2 border-transparent hover:border-yellow-500 transition-all duration-200 bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900 hover:shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <HistoryIcon className="w-6 h-6" />
                      <h3 className="text-lg font-semibold">View History</h3>
                    </div>
                    <p className="text-gray-700 text-sm">
                      View and export your delivery history
                    </p>
                    <div className="flex items-center space-x-1 text-gray-700">
                      <ClockIcon className="w-4 h-4" />
                      <span className="text-xs">Past 12 weeks available</span>
                    </div>
                  </div>
                  <HistoryIcon className="w-8 h-8 opacity-60" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Performance Stats Card */}
        {driverId && (
          <DriverStatsCard
            driverId={driverId}
            defaultPeriod="today"
            showTrends={true}
          />
        )}

        {/* Delivery Details */}
        <DriverDeliveries />
      </div>
    </div>
  );
};

export default DriverPage;
