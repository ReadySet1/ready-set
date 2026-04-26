'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Package } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ClientDeliveryConfiguration } from '@/lib/calculator/client-configurations';
import { VendorPricingEditor } from '@/components/calculator/VendorPricingEditor';

export function VendorPricingTab() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ClientDeliveryConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState<ClientDeliveryConfiguration | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingSave, setPendingSave] = useState<ClientDeliveryConfiguration | null>(null);

  const fetchConfigs = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      const response = await fetch('/api/calculator/configurations', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch configurations');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setConfigs(result.data);
        return result.data as ClientDeliveryConfiguration[];
      }
      return null;
    } catch (error) {
      toast({
        title: 'Error loading configurations',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleSaveRequest = (config: ClientDeliveryConfiguration) => {
    setPendingSave(config);
  };

  const handleConfirmSave = async () => {
    if (!pendingSave) return;
    const configToSave = pendingSave;
    setPendingSave(null);

    try {
      setIsSaving(true);
      const response = await fetch('/api/calculator/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(configToSave),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save configuration');
      }

      // Immediately update selected config with the saved data from POST response
      const savedConfig: ClientDeliveryConfiguration | null = result.data ?? null;
      if (savedConfig) {
        setSelectedConfig(savedConfig);
        // Optimistically update the configs array too
        setConfigs((prev) =>
          prev.map((c) => (c.id === savedConfig.id ? savedConfig : c))
        );
      }

      toast({
        title: 'Configuration saved',
        description: `Pricing for ${configToSave.vendorName} has been updated.`,
      });

      // Background refresh without loading skeleton to sync any other changes
      const freshConfigs = await fetchConfigs(false);
      if (freshConfigs && savedConfig) {
        // Re-select from the fresh configs array to stay in sync
        const updated = freshConfigs.find(
          (c: ClientDeliveryConfiguration) => c.id === savedConfig.id
        );
        if (updated) {
          setSelectedConfig(updated);
        }
      }
    } catch (error) {
      toast({
        title: 'Error saving configuration',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Loading skeletons
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-md rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-6 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (configs.length === 0) {
    return (
      <Card className="border-0 shadow-lg rounded-3xl bg-white/80 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full w-24 h-24 mb-6 flex items-center justify-center">
            <Package className="h-12 w-12 text-slate-400" />
          </div>
          <p className="text-xl font-medium text-slate-600 mb-2">No vendor configurations found</p>
          <p className="text-slate-500 max-w-md">
            Vendor configurations can be created from the Settings page. Once created, they will
            appear here for pricing adjustments.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vendor Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.map((cfg) => {
          const isSelected = selectedConfig?.id === cfg.id;
          return (
            <Card
              key={cfg.id}
              className={`border-0 shadow-md rounded-2xl bg-white transition-all duration-200 cursor-pointer hover:shadow-lg ${
                isSelected
                  ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg'
                  : 'hover:scale-[1.02]'
              }`}
              onClick={() => setSelectedConfig(cfg)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-900 text-sm leading-tight">
                    {cfg.vendorName}
                  </h3>
                  <Badge
                    variant={cfg.isActive ? 'default' : 'secondary'}
                    className={
                      cfg.isActive
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-xs'
                        : 'text-xs'
                    }
                  >
                    {cfg.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mb-1">{cfg.clientName}</p>
                {cfg.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{cfg.description}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selected vendor editor */}
      {selectedConfig && (
        <VendorPricingEditor
          config={selectedConfig}
          onSave={async (config) => handleSaveRequest(config)}
          isSaving={isSaving}
        />
      )}

      {/* Save confirmation dialog */}
      <AlertDialog open={pendingSave !== null} onOpenChange={() => setPendingSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Pricing Update
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to update pricing for{' '}
              <strong>{pendingSave?.vendorName}</strong>. This will affect all future
              calculations immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
