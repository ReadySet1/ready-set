'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckIcon, InboxIcon, UndoIcon, XIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

/**
 * Pending driver return-to-dispatch requests for the helpdesk/admin tracking
 * surface. Lists PENDING requests (driver, order, reason, details, age) with
 * Approve / Reject actions against PATCH /api/admin/return-requests/[id].
 * Rows are removed optimistically on success; failures surface as toasts
 * (never console-only).
 */

export interface ReturnRequestRow {
  id: string;
  orderNumber: string;
  orderType: string;
  driverId: string;
  driverName: string | null;
  reason: string;
  details: string | null;
  requestedAt: string;
}

const REASON_LABELS: Record<string, string> = {
  CANNOT_MAKE_PICKUP: "Can't make the pickup",
  VEHICLE_ISSUE: 'Vehicle issue',
  EMERGENCY: 'Emergency',
  STALE_ORDER: 'Old or expired assignment',
  ADMIN_UNASSIGNED: 'Unassigned by admin',
  OTHER: 'Other',
};

/** "5m ago" / "2h ago" style age for the request card. */
function formatAge(requestedAt: string): string {
  const ms = Date.now() - new Date(requestedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const REFRESH_INTERVAL_MS = 60_000;

interface ReturnRequestsPanelProps {
  className?: string;
}

export default function ReturnRequestsPanel({ className }: ReturnRequestsPanelProps) {
  const [requests, setRequests] = useState<ReturnRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/return-requests?status=PENDING', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Failed to load return requests (${res.status})`);
      const data = await res.json();
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch (err) {
      // Initial/interval load failures stay quiet in the UI chrome but are
      // visible in the console; action failures always toast (see resolve).
      console.warn('Failed to load return requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
    const interval = setInterval(() => void loadRequests(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const resolve = useCallback(
    async (request: ReturnRequestRow, action: 'approve' | 'reject') => {
      setActingId(request.id);
      try {
        const res = await fetch(`/api/admin/return-requests/${request.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            body?.error || `Failed to ${action} the request (${res.status})`,
          );
        }

        // Optimistic removal — the request is resolved either way.
        setRequests((prev) => prev.filter((r) => r.id !== request.id));

        if (body?.status === 'VOIDED') {
          toast(
            `Request for #${request.orderNumber} no longer applies — the order has moved on.`,
          );
        } else if (action === 'approve') {
          toast.success(`Return approved — #${request.orderNumber} is back in the pool.`);
        } else {
          toast.success(`Return request for #${request.orderNumber} rejected.`);
        }
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : `Failed to ${action} the return request.`,
        );
      } finally {
        setActingId(null);
      }
    },
    [],
  );

  return (
    <div className={cn('w-full space-y-3', className)}>
      <div className="flex items-center space-x-2">
        <UndoIcon className="w-4 h-4 text-orange-500" />
        <h4 className="font-medium">
          Pending Return Requests
          {!isLoading ? ` (${requests.length})` : ''}
        </h4>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-8 w-48" />
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <InboxIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No pending return requests</p>
        </div>
      ) : (
        requests.map((request) => (
          <Card key={request.id} className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <h5 className="font-medium">#{request.orderNumber}</h5>
                    <Badge variant="outline">
                      {request.orderType === 'catering' ? 'Catering' : 'On-Demand'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatAge(request.requestedAt)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Driver: </span>
                    {request.driverName || 'Unknown driver'}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reason: </span>
                    {REASON_LABELS[request.reason] ?? request.reason}
                  </div>
                  {request.details ? (
                    <div className="text-sm text-muted-foreground italic">
                      &ldquo;{request.details}&rdquo;
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    onClick={() => resolve(request, 'approve')}
                    disabled={actingId !== null}
                  >
                    <CheckIcon className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resolve(request, 'reject')}
                    disabled={actingId !== null}
                  >
                    <XIcon className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
