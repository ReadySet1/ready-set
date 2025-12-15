// src/app/(site)/(users)/client/orders/new/page.tsx
// Create on-demand order from client side

import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import NewOrderClient from './NewOrderClient';

// Force dynamic rendering to ensure database queries run at runtime
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New On-Demand Order | Ready Set',
  description: 'Create a new on-demand delivery order.',
};

const NewOrderPage = async () => {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect('/sign-in');
  }

  // Validate user role
  const allowedRoles = ['CLIENT', 'VENDOR'];
  if (!user.role || !allowedRoles.includes(user.role.toUpperCase())) {
    console.error('[NewOrderPage] User does not have client/vendor role:', user.role);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 sm:p-8">
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle className="text-red-800 font-semibold">Access Denied</AlertTitle>
                  <AlertDescription className="text-red-700">
                    You do not have permission to create orders. Please contact support if you believe this is an error.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <NewOrderClient userId={user.id} userEmail={user.email} />;
};

export default NewOrderPage;
