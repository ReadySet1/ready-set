/**
 * Carrier Webhook Logs Page
 *
 * Authentication: Protected by (backend) route group middleware
 * Authorization: Admin access required (enforced by layout)
 *
 * TODO: Implement webhook logging table to track real webhook activity
 */

import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/Dashboard/ui/PageHeader';
import { CarrierService } from '@/lib/services/carrierService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';

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
    title: `${carrier.name} Webhook Logs | Admin Dashboard`,
    description: `View webhook activity and logs for ${carrier.name}`,
  };
}

const CarrierLogsPage = async ({ params }: Props) => {
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
            title={`${carrier.name} Webhook Logs`}
            description="View webhook activity and delivery status updates"
            breadcrumbs={[
              { label: 'Carriers', href: '/admin/carriers' },
              { label: carrier.name, href: `/admin/carriers/${carrierId}` },
              { label: 'Logs', href: `/admin/carriers/${carrierId}/logs`, active: true }
            ]}
          />
        </header>

        <main className="flex-1 space-y-6 p-4 sm:px-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <CardTitle>Webhook Activity Logs</CardTitle>
              </div>
              <CardDescription>
                Real-time webhook delivery logs for {carrier.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Webhook Logging Coming Soon
                </h3>
                <p className="text-sm text-gray-600 max-w-md">
                  We're working on implementing comprehensive webhook logging to track all
                  status updates sent to {carrier.name}. This will include timestamps,
                  payloads, responses, and retry attempts.
                </p>
                <div className="mt-6 space-y-2">
                  <Badge variant="outline" className="text-xs">
                    Feature in Development
                  </Badge>
                </div>
              </div>

              {/* Future implementation will show logs table here */}
              {/*
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-600 pb-2 border-b">
                  <div>Timestamp</div>
                  <div>Order Number</div>
                  <div>Status</div>
                  <div>Response</div>
                  <div>Duration</div>
                </div>
                {logs.map(log => (
                  <div key={log.id} className="grid grid-cols-5 gap-4 text-sm py-2 border-b">
                    <div>{log.timestamp}</div>
                    <div>{log.orderNumber}</div>
                    <div><Badge>{log.status}</Badge></div>
                    <div>{log.response}</div>
                    <div>{log.duration}ms</div>
                  </div>
                ))}
              </div>
              */}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default CarrierLogsPage;
