import { Metadata } from 'next';
import { BreadcrumbNavigation } from '@/components/Dashboard';
import AdminTrackingDashboard from '@/components/Dashboard/Tracking/AdminTrackingDashboard';

export const metadata: Metadata = {
  title: 'Driver Tracking | Admin Dashboard',
  description: 'Real-time driver location tracking and delivery monitoring dashboard',
};

/**
 * Phase 3 Admin Tracking Dashboard
 * 
 * Live monitoring interface for:
 * - Real-time driver locations
 * - Active delivery tracking
 * - Shift management
 * - Route visualization
 * - Performance analytics
 */
export default function AdminTrackingPage() {
  return (
    <div className="flex w-full flex-col">
      {/* Header with breadcrumbs */}
      <div className="p-6 pb-0">
        <BreadcrumbNavigation
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Driver Tracking" },
          ]}
        />
      </div>
      
      {/* Main tracking dashboard */}
      <AdminTrackingDashboard />
    </div>
  );
}
