'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Route,
  Clock,
  Navigation,
  ChevronDown,
  ChevronUp,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { formatMiles, formatDuration } from '@/services/routing/route-utils';
import type { RouteResult, RouteLeg } from './types';
import { cn } from '@/lib/utils';

interface RouteResultsProps {
  route: RouteResult;
}

export default function RouteResults({ route }: RouteResultsProps) {
  const [expandedLeg, setExpandedLeg] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* ── Summary Card ────────────────────────────────────── */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Route className="h-5 w-5 text-amber-600" />
            Route Summary
          </CardTitle>
          <CardDescription>
            Optimal driving route calculated
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {/* Total Distance */}
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <Navigation className="h-3.5 w-3.5" />
                Total Distance
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatMiles(route.totalDistanceMiles)}
              </p>
            </div>

            {/* Total Duration */}
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <Clock className="h-3.5 w-3.5" />
                Est. Drive Time
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatDuration(route.totalDurationMinutes)}
              </p>
            </div>

            {/* Legs Count */}
            <div className="rounded-lg bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                <MapPin className="h-3.5 w-3.5" />
                Stops
              </div>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {route.legs.length + 1}
              </p>
            </div>
          </div>

          {/* Warnings */}
          {route.warnings.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-yellow-50 p-2 text-xs text-yellow-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>{route.warnings.join(' • ')}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Leg-by-Leg Breakdown ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Turn-by-Turn Directions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {route.legs.map((leg, idx) => (
            <LegAccordion
              key={idx}
              leg={leg}
              index={idx}
              expanded={expandedLeg === idx}
              onToggle={() =>
                setExpandedLeg(expandedLeg === idx ? null : idx)
              }
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Leg Accordion ──────────────────────────────────────────────────────────

function LegAccordion({
  leg,
  index,
  expanded,
  onToggle,
}: {
  leg: RouteLeg;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="shrink-0">
            Leg {index + 1}
          </Badge>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {leg.startAddress}
            </p>
            <p className="truncate text-xs text-gray-500">
              → {leg.endAddress}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{formatMiles(leg.distanceMiles)}</span>
          <span className="text-gray-300">|</span>
          <span>{formatDuration(leg.durationMinutes)}</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-3 pt-2">
          <ol className="space-y-1.5">
            {leg.steps.map((step, sIdx) => (
              <li
                key={sIdx}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500">
                  {sIdx + 1}
                </span>
                <span>
                  {step.instruction}
                  <span className="ml-1.5 text-xs text-gray-400">
                    ({formatMiles(step.distanceMiles)})
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
