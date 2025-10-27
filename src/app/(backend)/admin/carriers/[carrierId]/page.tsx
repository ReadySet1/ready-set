/**
 * Carrier Details Page
 *
 * Authentication: Protected by (backend) route group middleware
 * Authorization: Admin access required (enforced by layout)
 */

import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/Dashboard/ui/PageHeader';
import { CarrierDetails } from '@/components/Dashboard/CarrierManagement/CarrierDetails';
import { CarrierService } from '@/lib/services/carrierService';

type Props = {
  params: Promise<{
    carrierId: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { carrierId } = await params;
  const carrier = CarrierService.getCarrier(carrierId);

  if (!carrier) {
    return {
      title: 'Carrier Not Found | Admin Dashboard',
    };
  }

  return {
    title: `${carrier.name} Configuration | Admin Dashboard`,
    description: `Manage ${carrier.name} integration settings and monitor performance`,
  };
}

const CarrierDetailsPage = async ({ params }: Props) => {
  const { carrierId } = await params;
  const carrier = CarrierService.getCarrier(carrierId);

  if (!carrier) {
    notFound();
  }

  return (
    <div className="bg-muted/40 flex min-h-screen w-full flex-col">
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-4 border-b px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <PageHeader
            title={carrier.name}
            description="Manage carrier integration settings and monitor performance"
            breadcrumbs={[
              { label: 'Carriers', href: '/admin/carriers' },
              { label: carrier.name, href: `/admin/carriers/${carrierId}`, active: true }
            ]}
          />
        </header>

        <main className="flex-1 space-y-6 p-4 sm:px-6">
          <CarrierDetails carrierId={carrierId} />
        </main>
      </div>
    </div>
  );
};

export default CarrierDetailsPage;
