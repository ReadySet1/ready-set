"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import CreateCateringOrderForm from "@/components/Orders/CateringOrders/CreateCateringOrderForm";
import { ClientListItem } from "../_actions/schemas";
import { Plus, Users, ClipboardList } from "lucide-react";

interface NewCateringOrderClientProps {
  clients: ClientListItem[];
}

const NewCateringOrderClient: React.FC<NewCateringOrderClientProps> = ({
  clients,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="container mx-auto px-4 py-6 sm:px-6 sm:py-8"
      >
        {/* Modern Header */}
        <div className="mb-8">
          <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">
                  Create New Catering Order
                </h1>
                <p className="mt-1 text-slate-600">
                  Set up a new catering request for your clients
                </p>
              </div>
            </div>

            {/* Stats Cards - Mobile Hidden, Desktop Visible */}
            <div className="hidden items-center gap-4 lg:flex">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-600">
                    {clients.length} Client{clients.length !== 1 ? "s" : ""}{" "}
                    Available
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-slate-500">
            <Link
              href="/admin"
              className="transition-colors hover:text-slate-700"
            >
              Dashboard
            </Link>
            <span>/</span>
            <Link
              href="/admin/catering-orders"
              className="transition-colors hover:text-slate-700"
            >
              Catering Orders
            </Link>
            <span>/</span>
            <span className="font-medium text-slate-800">New Order</span>
          </nav>
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">
                    Order Information
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Fill in the details below to create a new catering order
                  </p>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 sm:p-8">
              <CreateCateringOrderForm clients={clients} />
            </div>
          </motion.div>

          {/* Mobile Stats Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">
                    Available Clients
                  </h3>
                  <p className="text-sm text-slate-600">
                    {clients.length} client{clients.length !== 1 ? "s" : ""}{" "}
                    ready for orders
                  </p>
                </div>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {clients.length}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default NewCateringOrderClient;
