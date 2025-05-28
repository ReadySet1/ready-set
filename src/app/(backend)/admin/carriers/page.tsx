import React from 'react';
import { Metadata } from 'next';
import { PageHeader } from '@/components/Dashboard/ui/PageHeader';
import { CarrierOverview } from '@/components/Dashboard/CarrierManagement/CarrierOverview';

export const metadata: Metadata = {
  title: 'Carrier Integrations | Admin Dashboard',
  description: 'Monitor and manage external carrier integrations',
};

const CarriersPage = () => {
  return (
    <div className="bg-muted/40 flex min-h-screen w-full flex-col">
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-4 border-b px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <PageHeader
            title="Carrier Integrations"
            description="Monitor and manage external delivery platform integrations"
            breadcrumbs={[
              { label: 'Carriers', href: '/admin/carriers', active: true }
            ]}
          />
        </header>
        
        <main className="flex-1 space-y-6 p-4 sm:px-6">
          <CarrierOverview />
        </main>
      </div>
    </div>
  );
};

export default CarriersPage; 