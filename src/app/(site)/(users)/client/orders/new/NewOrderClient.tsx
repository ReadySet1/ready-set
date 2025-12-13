"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CreateOnDemandOrderForm } from '@/components/Orders/OnDemand/CreateOnDemandOrderForm';
import { Plus, Truck, ArrowLeft } from 'lucide-react';
import Breadcrumb from '@/components/Common/Breadcrumb';

interface NewOrderClientProps {
  userId: string;
  userEmail?: string | null;
}

const NewOrderClient: React.FC<NewOrderClientProps> = ({ userId, userEmail }) => {
  return (
    <>
      <Breadcrumb
        pageName="New On-Demand Order"
        pageDescription="Create a new delivery request"
      />
      <section className="relative py-6 md:py-8">
        <div className="absolute left-0 top-0 -z-[1] h-full w-full dark:bg-dark"></div>
        <div className="absolute left-0 top-0 -z-[1] h-1/2 w-full bg-[#E9F9FF] dark:bg-dark-700 lg:h-[45%] xl:h-1/2"></div>
        <div className="container px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Back to Dashboard Link */}
            <div className="mb-6 flex items-center">
              <Link
                href="/client"
                className="flex items-center text-sm text-gray-600 transition-colors hover:text-primary"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </div>

            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <Plus className="h-8 w-8 text-white" />
              </div>
              <h1 className="mb-2 text-3xl font-bold text-gray-900">Create New On-Demand Order</h1>
              <p className="text-gray-600">
                {userEmail ? `Ordering as ${userEmail}` : 'Fill in the details below to create a new delivery request'}
              </p>
            </div>

            {/* Main Content */}
            <div className="mx-auto max-w-4xl">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {/* Form Header */}
                <div className="border-b border-slate-100 p-6 sm:p-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600">
                      <Truck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-800">Order Information</h2>
                      <p className="mt-1 text-sm text-slate-600">Enter the delivery details below</p>
                    </div>
                  </div>
                </div>

                {/* Form Content */}
                <div className="p-6 sm:p-8">
                  <CreateOnDemandOrderForm preSelectedUserId={userId} />
                </div>
              </motion.div>

              {/* Help Card */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="mb-2 font-semibold text-slate-800">Need Help?</h3>
                <p className="text-sm text-slate-600">
                  If you have any questions about creating an order, please{' '}
                  <Link href="/contact" className="font-medium text-primary hover:underline">
                    contact us
                  </Link>{' '}
                  and our team will be happy to assist you.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default NewOrderClient;
