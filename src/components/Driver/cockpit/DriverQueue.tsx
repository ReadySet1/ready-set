'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, LogOut, RefreshCw, Truck, UserIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { UserStatus } from '@/types/user';
import { isDeliveryCompleted } from '@/lib/delivery-status-transitions';
import { clearAuthCookies } from '@/utils/auth/cookies';
import { createClient } from '@/utils/supabase/client';
import { DriverQueueCard } from './DriverQueueCard';
import type { CockpitDelivery } from '@/types/driver-cockpit';

interface ProfileData {
  name?: string;
  firstName?: string;
  status?: string;
}

/**
 * Self-contained driver queue page.
 * Fetches deliveries from /api/driver-deliveries and splits into
 * NOW (active today), UP NEXT (future assigned), DONE TODAY (completed today).
 */
export function DriverQueue() {
  const [deliveries, setDeliveries] = useState<CockpitDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { logout } = useUser();
  const supabase = createClient();

  const handleSignOut = async () => {
    try {
      clearAuthCookies();
      await supabase.auth.signOut();
      window.location.href = '/sign-in';
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      setIsProfileLoading(true);
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setIsProfileLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // Fetch deliveries
  const fetchDeliveries = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch('/api/driver-deliveries?page=1&limit=999');
      if (!res.ok) throw new Error('Failed to fetch deliveries');
      const data = await res.json();
      const list = data?.deliveries ?? (Array.isArray(data) ? data : []);
      setDeliveries(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  // Split deliveries into sections
  const { now, upNext, doneToday } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nowList: CockpitDelivery[] = [];
    const upNextList: CockpitDelivery[] = [];
    const doneTodayList: CockpitDelivery[] = [];

    for (const d of deliveries) {
      const pickupDate = new Date(d.pickupDateTime);
      const completed = isDeliveryCompleted(d.driverStatus);

      if (completed) {
        // Show in done if completed today
        const completedDate = d.completeDateTime ? new Date(d.completeDateTime) : null;
        if (completedDate && completedDate >= today && completedDate < tomorrow) {
          doneTodayList.push(d);
        } else if (pickupDate >= today && pickupDate < tomorrow) {
          doneTodayList.push(d);
        }
      } else if (pickupDate >= tomorrow) {
        upNextList.push(d);
      } else {
        // Today or overdue active deliveries
        nowList.push(d);
      }
    }

    // Sort: NOW by pickup time ascending, UP NEXT by pickup ascending, DONE by completed descending
    nowList.sort((a, b) => new Date(a.pickupDateTime).getTime() - new Date(b.pickupDateTime).getTime());
    upNextList.sort((a, b) => new Date(a.pickupDateTime).getTime() - new Date(b.pickupDateTime).getTime());
    doneTodayList.sort((a, b) => new Date(b.pickupDateTime).getTime() - new Date(a.pickupDateTime).getTime());

    return { now: nowList, upNext: upNextList, doneToday: doneTodayList };
  }, [deliveries]);

  const driverName = profile?.name || profile?.firstName || 'Driver';
  const accountStatus = profile?.status?.toString().toLowerCase();
  const isDeleted = accountStatus === UserStatus.DELETED;
  const isPending = accountStatus === UserStatus.PENDING;

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FBD113] rounded-full flex items-center justify-center">
              <Truck className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {driverName}
              </h1>
              <p className="text-xs text-gray-500">Driver Queue</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchDeliveries(true)}
              disabled={isRefreshing}
              className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-gray-100"
              aria-label="Refresh deliveries"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-gray-100"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6 max-w-lg mx-auto">
        {/* Account status alerts */}
        {!isProfileLoading && (isPending || isDeleted) && (
          <Alert
            variant={isDeleted ? 'destructive' : 'default'}
            className={isPending
              ? 'border-amber-500/50 bg-amber-50 text-amber-800 [&>svg]:text-amber-800'
              : undefined}
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {isPending ? 'Account Pending Approval' : 'Account Deactivated'}
            </AlertTitle>
            <AlertDescription>
              {isPending
                ? 'Your account is being reviewed. Some features may be limited.'
                : 'Your account has been deactivated. Please contact support.'}
            </AlertDescription>
          </Alert>
        )}

        {isDeleted ? (
          <div className="text-center py-16">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <p className="text-gray-600">Account access disabled.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-600 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchDeliveries()}>
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* NOW */}
            <QueueSection title="Now" count={now.length} emptyMessage="No active deliveries right now.">
              {now.map((d) => (
                <DriverQueueCard key={d.id} delivery={d} section="now" />
              ))}
            </QueueSection>

            {/* UP NEXT */}
            <QueueSection title="Up Next" count={upNext.length} emptyMessage="No upcoming deliveries.">
              {upNext.map((d) => (
                <DriverQueueCard key={d.id} delivery={d} section="up_next" />
              ))}
            </QueueSection>

            {/* DONE TODAY */}
            <QueueSection title="Done Today" count={doneToday.length} emptyMessage="No completed deliveries today.">
              {doneToday.map((d) => (
                <DriverQueueCard key={d.id} delivery={d} section="done_today" />
              ))}
              {doneToday.length > 0 && (
                <Link
                  href="/driver/history"
                  className="block text-center text-sm font-medium text-[#c5a210] mt-2 py-2"
                >
                  View All History
                </Link>
              )}
            </QueueSection>
          </>
        )}
      </div>
    </div>
  );
}

function QueueSection({
  title,
  count,
  emptyMessage,
  children,
}: {
  title: string;
  count: number;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          {title}
        </h2>
        <span className="text-xs text-gray-500">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}
