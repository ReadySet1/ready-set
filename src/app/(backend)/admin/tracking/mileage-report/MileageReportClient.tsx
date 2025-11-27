'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DownloadIcon,
  FilterIcon,
  RefreshCwIcon,
  NavigationIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MileageRow {
  driverId: string;
  shiftId: string;
  shiftStart: string;
  shiftEnd: string | null;
  totalDistanceMiles: number;
  gpsDistanceMiles: number;
  reportedDistanceMiles: number | null;
  mileageSource: string;
  deliveryCount: number;
}

interface MileageApiResponse {
  success: boolean;
  data: MileageRow[];
}

export default function MileageReportClient() {
  const [driverId, setDriverId] = useState('');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return format(weekAgo, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MileageRow[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('startDate', `${startDate}T00:00:00.000Z`);
      params.set('endDate', `${endDate}T23:59:59.999Z`);
      if (driverId.trim()) {
        params.set('driverId', driverId.trim());
      }

      const response = await fetch(`/api/tracking/mileage?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.details || payload?.error || 'Failed to fetch mileage data');
      }

      const payload = (await response.json()) as MileageApiResponse;
      if (!payload.success) {
        throw new Error('Mileage API returned an error');
      }

      setRows(payload.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching mileage data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      params.set('startDate', `${startDate}T00:00:00.000Z`);
      params.set('endDate', `${endDate}T23:59:59.999Z`);
      params.set('format', 'csv');
      if (driverId.trim()) {
        params.set('driverId', driverId.trim());
      }

      const response = await fetch(`/api/tracking/mileage?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv',
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.details || payload?.error || 'Failed to export mileage CSV');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mileage-report-${startDate}-to-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error exporting CSV';
      setError(message);
    }
  };

  useEffect(() => {
    // Load initial data on mount
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalMiles = rows.reduce((sum, row) => sum + (row.totalDistanceMiles || 0), 0);
  const totalDeliveries = rows.reduce((sum, row) => sum + (row.deliveryCount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <NavigationIcon className="w-5 h-5" />
              <span>Driver Mileage Reports</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="driverId">Driver ID (optional)</Label>
              <Input
                id="driverId"
                placeholder="Driver UUID"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                className="w-full"
                variant="default"
                disabled={loading}
                onClick={fetchData}
              >
                <FilterIcon className="w-4 h-4 mr-2" />
                Apply Filters
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 mt-4">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>
                <strong>Total Shifts:</strong> {rows.length}
              </span>
              <span>
                <strong>Total Distance:</strong> {Math.round(totalMiles * 10) / 10} mi
              </span>
              <span>
                <strong>Total Deliveries:</strong> {totalDeliveries}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={fetchData}
              >
                <RefreshCwIcon className={cn('w-4 h-4 mr-2', { 'animate-spin': loading })} />
                Refresh
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div
          role="status"
          aria-live="polite"
          className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-md px-3 py-2"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Shift Mileage Details</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-2 py-2">Driver ID</th>
                <th className="px-2 py-2">Shift ID</th>
                <th className="px-2 py-2">Shift Start</th>
                <th className="px-2 py-2">Shift End</th>
                <th className="px-2 py-2 text-right">Distance (mi)</th>
                <th className="px-2 py-2 text-right">Source</th>
                <th className="px-2 py-2 text-right">Deliveries</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-2 py-4 text-center text-sm text-muted-foreground"
                  >
                    No mileage records found for the selected filters.
                  </td>
                </tr>
              )}

              {rows.map((row) => (
                <tr key={row.shiftId} className="border-b last:border-0">
                  <td className="px-2 py-2 font-mono text-xs">
                    {row.driverId.slice(0, 8)}...
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {row.shiftId.slice(0, 8)}...
                  </td>
                  <td className="px-2 py-2">
                    {new Date(row.shiftStart).toLocaleString()}
                  </td>
                  <td className="px-2 py-2">
                    {row.shiftEnd ? new Date(row.shiftEnd).toLocaleString() : '\u2014'}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {Math.round(row.totalDistanceMiles * 10) / 10}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-xs',
                      row.mileageSource === 'gps' && 'bg-green-100 text-green-700',
                      row.mileageSource === 'odometer' && 'bg-blue-100 text-blue-700',
                      row.mileageSource === 'hybrid' && 'bg-yellow-100 text-yellow-700',
                      row.mileageSource === 'manual' && 'bg-gray-100 text-gray-700'
                    )}>
                      {row.mileageSource}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    {row.deliveryCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
