"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CreateOnDemandOrderForm } from '@/components/Orders/OnDemand/CreateOnDemandOrderForm';
import { ClientListItem } from '../_actions/schemas';
import { Plus, Users, Truck } from 'lucide-react';

interface NewOnDemandOrderClientProps {
  clients: ClientListItem[];
}

const NewOnDemandOrderClient: React.FC<NewOnDemandOrderClientProps> = ({ clients }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="container mx-auto px-4 sm:px-6 py-6 sm:py-8"
      >
        {/* Modern Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Create New On-Demand Order</h1>
                <p className="text-slate-600 mt-1">Set up a new on-demand delivery request</p>
              </div>
            </div>

            {/* Stats Cards - Mobile Hidden, Desktop Visible */}
            <div className="hidden lg:flex items-center gap-4">
              <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-600">
                    {clients.length} Client{clients.length !== 1 ? 's' : ''} Available
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-slate-500">
            <Link href="/admin" className="hover:text-slate-700 transition-colors">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/on-demand-orders" className="hover:text-slate-700 transition-colors">On-Demand Orders</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">New Order</span>
          </nav>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            {/* Form Header */}
            <div className="p-6 sm:p-8 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Order Information</h2>
                  <p className="text-slate-600 text-sm mt-1">Fill in the details below to create a new on-demand delivery order</p>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 sm:p-8">
              <CreateOnDemandOrderForm clients={clients} />
            </div>
          </motion.div>

          {/* Mobile Stats Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="lg:hidden mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Available Clients</h3>
                  <p className="text-sm text-slate-600">{clients.length} client{clients.length !== 1 ? 's' : ''} ready for orders</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-green-600">{clients.length}</div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default NewOnDemandOrderClient;
