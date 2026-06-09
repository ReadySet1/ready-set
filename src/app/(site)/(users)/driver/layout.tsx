'use client';

import dynamic from 'next/dynamic';
import { DriverTrackingProvider } from '@/contexts/DriverTrackingContext';
import { DriverThemeProvider } from '@/components/Driver/ui/DriverThemeProvider';
import { BottomNav } from '@/components/Driver/ui/BottomNav';
import { ShiftPill } from '@/components/Driver/ui/ShiftPill';

// Dynamically import LocationSimulator only in development
// This ensures it's tree-shaken in production builds
const LocationSimulator =
  process.env.NODE_ENV === 'development'
    ? dynamic(() => import('@/components/dev/LocationSimulator'), {
        ssr: false,
      })
    : () => null;

interface DriverLayoutProps {
  children: React.ReactNode;
}

export default function DriverLayout({ children }: DriverLayoutProps) {
  return (
    <DriverTrackingProvider>
      <DriverThemeProvider>
        {children}
        <ShiftPill />
        <BottomNav />
        {process.env.NODE_ENV === 'development' && <LocationSimulator />}
      </DriverThemeProvider>
    </DriverTrackingProvider>
  );
}
