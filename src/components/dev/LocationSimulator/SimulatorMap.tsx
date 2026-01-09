'use client';

/**
 * Simulator Map Component
 *
 * A simple SVG-based map preview showing the route and current position.
 * This is a lightweight alternative to using a full mapping library.
 */

import { useMemo } from 'react';
import type { RouteWaypoint, SimulatedPosition } from '@/lib/dev/geolocation-mock';
import type { SimulatorDelivery } from '@/lib/dev/route-utils';
import { cn } from '@/lib/utils';

interface SimulatorMapProps {
  waypoints: RouteWaypoint[];
  currentPosition: SimulatedPosition | null;
  selectedDelivery: SimulatorDelivery | null;
  height?: number;
}

export function SimulatorMap({
  waypoints,
  currentPosition,
  selectedDelivery,
  height = 120,
}: SimulatorMapProps) {
  // Calculate bounds and scale factors
  const mapData = useMemo(() => {
    if (waypoints.length === 0) {
      return null;
    }

    // Find bounding box
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const wp of waypoints) {
      minLat = Math.min(minLat, wp.latitude);
      maxLat = Math.max(maxLat, wp.latitude);
      minLng = Math.min(minLng, wp.longitude);
      maxLng = Math.max(maxLng, wp.longitude);
    }

    // Add padding
    const latPadding = (maxLat - minLat) * 0.15 || 0.001;
    const lngPadding = (maxLng - minLng) * 0.15 || 0.001;
    minLat -= latPadding;
    maxLat += latPadding;
    minLng -= lngPadding;
    maxLng += lngPadding;

    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;

    // Convert coordinates to SVG points
    const toSvgPoint = (lat: number, lng: number, width: number, svgHeight: number) => {
      const x = ((lng - minLng) / lngRange) * width;
      // Invert Y because SVG Y increases downward, but latitude increases upward
      const y = ((maxLat - lat) / latRange) * svgHeight;
      return { x, y };
    };

    return {
      minLat,
      maxLat,
      minLng,
      maxLng,
      latRange,
      lngRange,
      toSvgPoint,
    };
  }, [waypoints]);

  if (!mapData || waypoints.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-slate-800 text-slate-500 text-sm"
        style={{ height }}
      >
        Select a route to preview
      </div>
    );
  }

  const width = 360;
  const svgHeight = height;
  const { toSvgPoint } = mapData;

  // Get first and last waypoints
  const firstWaypoint = waypoints[0];
  const lastWaypoint = waypoints[waypoints.length - 1];

  // Early return if we don't have valid waypoints
  if (!firstWaypoint || !lastWaypoint) {
    return (
      <div
        className="flex items-center justify-center bg-slate-800 text-slate-500 text-sm"
        style={{ height }}
      >
        Invalid route data
      </div>
    );
  }

  // Generate path for route
  const routePath = waypoints
    .map((wp, i) => {
      const { x, y } = toSvgPoint(wp.latitude, wp.longitude, width, svgHeight);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Get start and end points
  const startPoint = toSvgPoint(
    firstWaypoint.latitude,
    firstWaypoint.longitude,
    width,
    svgHeight
  );
  const endPoint = toSvgPoint(
    lastWaypoint.latitude,
    lastWaypoint.longitude,
    width,
    svgHeight
  );

  // Get current position point
  const currentPoint = currentPosition
    ? toSvgPoint(currentPosition.latitude, currentPosition.longitude, width, svgHeight)
    : null;

  return (
    <div className="relative bg-slate-800 overflow-hidden" style={{ height }}>
      <svg width={width} height={svgHeight} className="w-full h-full">
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(100, 116, 139, 0.1)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Route line */}
        <path
          d={routePath}
          fill="none"
          stroke="rgba(251, 191, 36, 0.5)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start point (pickup - green) */}
        <circle
          cx={startPoint.x}
          cy={startPoint.y}
          r="6"
          fill="#22c55e"
          stroke="#166534"
          strokeWidth="2"
        />
        <text
          x={startPoint.x + 10}
          y={startPoint.y + 4}
          className="text-[10px] fill-slate-400"
        >
          Start
        </text>

        {/* End point (delivery - red) */}
        <circle
          cx={endPoint.x}
          cy={endPoint.y}
          r="6"
          fill="#ef4444"
          stroke="#991b1b"
          strokeWidth="2"
        />
        <text
          x={endPoint.x + 10}
          y={endPoint.y + 4}
          className="text-[10px] fill-slate-400"
        >
          End
        </text>

        {/* Current position (blue, animated) */}
        {currentPoint && (
          <>
            {/* Pulse animation */}
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r="10"
              fill="rgba(59, 130, 246, 0.3)"
              className="animate-ping"
            />
            {/* Direction indicator (arrow showing heading) */}
            {currentPosition && currentPosition.heading > 0 && (
              <g
                transform={`translate(${currentPoint.x}, ${currentPoint.y}) rotate(${currentPosition.heading})`}
              >
                <path
                  d="M 0 -8 L 4 4 L 0 2 L -4 4 Z"
                  fill="#3b82f6"
                  stroke="#1d4ed8"
                  strokeWidth="1"
                />
              </g>
            )}
            {/* Position dot */}
            {(!currentPosition || currentPosition.heading === 0) && (
              <circle
                cx={currentPoint.x}
                cy={currentPoint.y}
                r="5"
                fill="#3b82f6"
                stroke="#1d4ed8"
                strokeWidth="2"
              />
            )}
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-1 right-2 flex items-center gap-3 text-[10px] text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Pickup</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Delivery</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Current</span>
        </div>
      </div>

      {/* Delivery info overlay */}
      {selectedDelivery && (
        <div className="absolute top-1 left-2 text-[10px] text-slate-400 max-w-[200px] truncate">
          {selectedDelivery.customerName || selectedDelivery.orderNumber}
        </div>
      )}
    </div>
  );
}
