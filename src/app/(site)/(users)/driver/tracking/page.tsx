import { Metadata, Viewport } from 'next';
import DriverTrackingPortal from '@/components/Driver/DriverTrackingPortal';

export const metadata: Metadata = {
  title: 'Driver Tracking Portal | ReadySet',
  description: 'Real-time location tracking and shift management for ReadySet drivers',
  manifest: '/manifest.json',
  // themeColor must be moved to viewport export in Next 15
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ReadySet Driver',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover', // resolve env(safe-area-inset-*) so the native WebView clears the status bar
  themeColor: '#1f2937',
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
  return <DriverTrackingPortal />;
}