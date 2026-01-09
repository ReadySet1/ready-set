'use client';

import { DriverTrackingProvider } from '@/contexts/DriverTrackingContext';
import { DriverTrackingIndicator } from '@/components/Driver/DriverTrackingIndicator';

interface DriverLayoutProps {
  children: React.ReactNode;
}

export default function DriverLayout({ children }: DriverLayoutProps) {
  return (
    <DriverTrackingProvider>
      {children}
      <DriverTrackingIndicator />
    </DriverTrackingProvider>
  );
}
