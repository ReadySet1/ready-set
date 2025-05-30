// src/app/(backend)/admin/catering-orders/new/page.tsx
// Create order from admin side

import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/Dashboard/ui/PageHeader';
import { CreateCateringOrderForm } from '@/components/Orders/CateringOrders/CreateCateringOrderForm';
import { getClients } from '../_actions/catering-orders';
import { ClientListItem } from '../_actions/schemas';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Plus, Users, ClipboardList } from 'lucide-react';
import NewCateringOrderClient from './NewCateringOrderClient';

export const metadata: Metadata = {
  title: 'New Catering Order | Admin Dashboard',
  description: 'Create a new catering order.',
};

const NewCateringOrderPage = async () => {
  const clientResult = await getClients();

  if ('error' in clientResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 sm:p-8">
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle className="text-red-800 font-semibold">Error Loading Clients</AlertTitle>
                  <AlertDescription className="text-red-700">
                    Could not load client list. Please try again later or contact support if the issue persists.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const clients = clientResult as ClientListItem[];

  return <NewCateringOrderClient clients={clients} />;
};

export default NewCateringOrderPage; 