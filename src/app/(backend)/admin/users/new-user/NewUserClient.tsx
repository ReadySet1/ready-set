"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import DriverHelpdeskRegistrationForm from './ui/registration-form';
import { UserPlus, Users, Shield, Truck } from 'lucide-react';

const NewUserClient: React.FC = () => {
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
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <UserPlus className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Create New User</h1>
                <p className="text-slate-600 mt-1">Register a new driver or helpdesk staff member</p>
              </div>
            </div>
            
            {/* User Type Cards - Mobile Hidden, Desktop Visible */}
            <div className="hidden lg:flex items-center gap-4">
              <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-600">Driver Account</span>
                </div>
              </div>
              <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-600">Helpdesk Account</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-slate-500">
            <Link href="/admin" className="hover:text-slate-700 transition-colors">Dashboard</Link>
            <span>/</span>
            <Link href="/admin/users" className="hover:text-slate-700 transition-colors">Users</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">New User</span>
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
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">User Registration</h2>
                  <p className="text-slate-600 text-sm mt-1">Fill in the details below to create a new user account</p>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 sm:p-8">
              <DriverHelpdeskRegistrationForm />
            </div>
          </motion.div>

          {/* Mobile User Type Cards */}
          <div className="lg:hidden mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Driver Account</h3>
                  <p className="text-sm text-slate-600">For delivery drivers</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Helpdesk Account</h3>
                  <p className="text-sm text-slate-600">For support staff</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Info Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Account Creation Guidelines</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Driver accounts have access to mobile app and delivery management</li>
                  <li>• Helpdesk accounts can manage orders and provide customer support</li>
                  <li>• All new users will receive an email with login instructions</li>
                  <li>• Ensure contact information is accurate for account verification</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default NewUserClient; 