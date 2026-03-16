'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Navigation, Gauge, Copy, Check } from 'lucide-react';
import type { MileageCalculation } from '@/types/mileage';
import { useState } from 'react';

interface MileageResultsProps {
  calculation: MileageCalculation;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '< 1 min';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function MileageResults({ calculation }: MileageResultsProps) {
  const [copied, setCopied] = useState(false);

  const avgSpeed =
    calculation.totalDurationMinutes > 0
      ? (calculation.totalDistanceMiles / (calculation.totalDurationMinutes / 60))
      : 0;

  const handleCopy = async () => {
    const lines = [
      `Total Distance: ${calculation.totalDistanceMiles.toFixed(1)} miles`,
      `Est. Drive Time: ${formatDuration(calculation.totalDurationMinutes)}`,
      `Stops: ${calculation.dropoffs.length}`,
      '',
      'Leg Breakdown:',
      ...calculation.legs.map(
        (leg, i) =>
          `  ${i + 1}. ${leg.from} → ${leg.to}: ${leg.distanceMiles.toFixed(1)} mi, ${formatDuration(leg.durationMinutes)}`,
      ),
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="pt-4 pb-4 text-center">
            <Navigation className="h-5 w-5 text-emerald-600 mx-auto mb-1.5" />
            <div className="text-2xl font-bold text-emerald-700">
              {calculation.totalDistanceMiles.toFixed(1)}
            </div>
            <div className="text-xs font-medium text-emerald-600/70">miles</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="h-5 w-5 text-blue-600 mx-auto mb-1.5" />
            <div className="text-2xl font-bold text-blue-700">
              {formatDuration(calculation.totalDurationMinutes)}
            </div>
            <div className="text-xs font-medium text-blue-600/70">drive time</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="pt-4 pb-4 text-center">
            <MapPin className="h-5 w-5 text-purple-600 mx-auto mb-1.5" />
            <div className="text-2xl font-bold text-purple-700">
              {calculation.dropoffs.length}
            </div>
            <div className="text-xs font-medium text-purple-600/70">
              {calculation.dropoffs.length === 1 ? 'stop' : 'stops'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-br from-slate-50 to-gray-50">
          <CardContent className="pt-4 pb-4 text-center">
            <Gauge className="h-5 w-5 text-slate-600 mx-auto mb-1.5" />
            <div className="text-2xl font-bold text-slate-700">
              {avgSpeed.toFixed(0)}
            </div>
            <div className="text-xs font-medium text-slate-500">avg mph</div>
          </CardContent>
        </Card>
      </div>

      {/* Leg Breakdown Table */}
      <Card className="border-0 shadow-sm rounded-2xl bg-white">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">
              Route Breakdown
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-slate-500 hover:text-slate-700 rounded-lg"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy Results
                </>
              )}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Leg
                  </th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    From
                  </th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    To
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Distance
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {calculation.legs.map((leg, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-2.5 px-2">
                      <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-600 text-xs"
                      >
                        {i + 1}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 text-slate-700 max-w-[180px] truncate">
                      {leg.from}
                    </td>
                    <td className="py-2.5 px-2 text-slate-700 max-w-[180px] truncate">
                      {leg.to}
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-slate-800">
                      {leg.distanceMiles.toFixed(1)} mi
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-600">
                      {formatDuration(leg.durationMinutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td
                    colSpan={3}
                    className="py-2.5 px-2 text-sm font-semibold text-slate-700"
                  >
                    Total
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-emerald-700">
                    {calculation.totalDistanceMiles.toFixed(1)} mi
                  </td>
                  <td className="py-2.5 px-2 text-right font-semibold text-blue-700">
                    {formatDuration(calculation.totalDurationMinutes)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
