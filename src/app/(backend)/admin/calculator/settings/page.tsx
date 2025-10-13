// Calculator Settings Page - Admin interface for managing calculator configuration
// Allows admins to adjust pricing rules, tiers, and calculator behavior

'use client';

import { useState } from 'react';
import { ClientConfigurationManager } from '@/components/calculator/ClientConfigurationManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CalculatorSettingsPage() {
  const [currentConfigId, setCurrentConfigId] = useState<string>('ready-set-food-standard');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="container mx-auto py-6 px-4 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/admin/calculator"
            className="text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Client Configuration Settings
            </h1>
            <p className="text-slate-600">
              Manage delivery calculator configurations for different clients and vendors
            </p>
          </div>
        </div>

        {/* Client Configuration Manager */}
        <ClientConfigurationManager
          currentConfigId={currentConfigId}
          onConfigurationChange={(config) => {
            setCurrentConfigId(config.id);
                      }}
        />
      </div>
    </div>
  );
}
