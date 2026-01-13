'use client';

import dynamic from 'next/dynamic';
import { DriverTrackingProvider } from '@/contexts/DriverTrackingContext';
import { DriverTrackingIndicator } from '@/components/Driver/DriverTrackingIndicator';

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
      {children}
      <DriverTrackingIndicator />
      {process.env.NODE_ENV === 'development' && <LocationSimulator />}
    </DriverTrackingProvider>
  );
}
