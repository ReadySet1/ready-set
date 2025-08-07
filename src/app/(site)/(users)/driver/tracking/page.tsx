import { Metadata } from 'next';
import DriverTrackingPortal from '@/components/Driver/DriverTrackingPortal';

export const metadata: Metadata = {
  title: 'Driver Tracking Portal | ReadySet',
  description: 'Real-time location tracking and shift management for ReadySet drivers',
  manifest: '/manifest.json',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  themeColor: '#1f2937',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ReadySet Driver',
  },
};

/**
 * Phase 2 Driver Tracking Portal
 * 
 * New PWA-focused driver portal with:
 * - Real-time GPS location tracking
 * - Shift management (start/end/break)
 * - Live delivery updates
 * - Offline capability
 * - Mobile-optimized interface
 */
export default function DriverTrackingPage() {
  return (
    <div className="min-h-screen bg-background">
      <DriverTrackingPortal />
    </div>
  );
}