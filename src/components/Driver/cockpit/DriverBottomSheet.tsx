'use client';

import React from 'react';

interface DriverBottomSheetProps {
  children: React.ReactNode;
}

/**
 * Fixed white container below the map area with rounded top corners.
 * Provides safe-area padding for notched devices.
 * Not a draggable sheet -- just a layout container.
 */
export function DriverBottomSheet({ children }: DriverBottomSheetProps) {
  return (
    <div className="flex-1 bg-white rounded-t-2xl -mt-4 relative z-10 overflow-y-auto pb-safe">
      <div className="px-5 pt-5 pb-8 space-y-4">
        {children}
      </div>
    </div>
  );
}
