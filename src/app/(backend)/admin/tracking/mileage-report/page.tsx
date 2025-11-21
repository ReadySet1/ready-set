import 'server-only';

import { Metadata } from 'next';
import { Suspense } from 'react';
import { BreadcrumbNavigation } from '@/components/Dashboard';
import MileageReportClient from './MileageReportClient';

export const metadata: Metadata = {
  title: 'Driver Mileage Reports | Admin Dashboard',
  description: 'View and export driver mileage by shift and date range.',
};

export default function MileageReportPage() {
  return (
    <div className="flex w-full flex-col">
      <div className="p-6 pb-0">
        <BreadcrumbNavigation
          items={[
            { label: 'Dashboard', href: '/admin' },
            { label: 'Driver Tracking', href: '/admin/tracking' },
            { label: 'Mileage Reports' },
          ]}
        />
      </div>

      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading mileage report...</div>}>
        <MileageReportClient />
      </Suspense>
    </div>
  );
}


