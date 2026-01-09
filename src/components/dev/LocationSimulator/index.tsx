'use client';

/**
 * Location Simulator Panel
 *
 * A floating dev panel for simulating driver locations during development.
 * This component mocks the browser's Geolocation API to test the delivery
 * tracking system without needing to physically move.
 *
 * DEVELOPMENT ONLY - This component will not render in production.
 */

import { useState, useEffect } from 'react';
import { useLocationSimulator } from '@/hooks/dev/useLocationSimulator';
import { SimulatorControls } from './SimulatorControls';
import { SimulatorMap } from './SimulatorMap';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  X,
  GripVertical,
} from 'lucide-react';

interface LocationSimulatorProps {
  defaultOpen?: boolean;
  defaultMinimized?: boolean;
}

export function LocationSimulator({
  defaultOpen = true,
  defaultMinimized = false,
}: LocationSimulatorProps) {
  // All hooks must be called unconditionally at the top
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const simulator = useLocationSimulator();

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  // Don't render in production (check after all hooks)
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Closed state - just show a floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed z-[9999] flex items-center gap-2 rounded-full',
          'bg-amber-500 text-white shadow-lg',
          'px-4 py-2 text-sm font-medium',
          'hover:bg-amber-600 transition-colors',
          'animate-pulse'
        )}
        style={{ right: 16, bottom: 16 }}
        title="Open Location Simulator"
      >
        <MapPin className="h-4 w-4" />
        <span>Simulator</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        'fixed z-[9999] flex flex-col',
        'bg-slate-900 text-white rounded-lg shadow-2xl',
        'border border-slate-700',
        'overflow-hidden',
        isDragging && 'cursor-grabbing select-none'
      )}
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 280 : 360,
      }}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between gap-2',
          'bg-slate-800 px-3 py-2',
          'border-b border-slate-700'
        )}
      >
        <div
          className="flex items-center gap-2 cursor-grab flex-1"
          onMouseDown={handleDragStart}
        >
          <GripVertical className="h-4 w-4 text-slate-500" />
          <MapPin className="h-4 w-4 text-amber-500" />
          <span className="font-semibold text-sm">Location Simulator</span>
          {simulator.status === 'running' && (
            <span className="ml-2 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400">Live</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-white"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="flex flex-col">
          {/* Map Preview */}
          <SimulatorMap
            waypoints={simulator.waypoints}
            currentPosition={simulator.currentPosition}
            selectedDelivery={simulator.selectedDelivery}
          />

          {/* Controls */}
          <SimulatorControls simulator={simulator} />
        </div>
      )}

      {/* Minimized status bar */}
      {isMinimized && (
        <div className="px-3 py-2 text-xs text-slate-400">
          {simulator.status === 'running' ? (
            <span className="text-green-400">
              Simulating: {simulator.progress.toFixed(0)}%
            </span>
          ) : simulator.status === 'paused' ? (
            <span className="text-amber-400">Paused</span>
          ) : simulator.isEnabled ? (
            <span>Ready</span>
          ) : (
            <span>Disabled</span>
          )}
        </div>
      )}
    </div>
  );
}

export default LocationSimulator;
