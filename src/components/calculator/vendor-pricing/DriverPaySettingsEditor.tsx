'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { ClientDeliveryConfiguration } from '@/lib/calculator/client-configurations';

type DriverPaySettings = ClientDeliveryConfiguration['driverPaySettings'];

interface DriverPaySettingsEditorProps {
  settings: DriverPaySettings;
  onChange: (settings: DriverPaySettings) => void;
}

export function DriverPaySettingsEditor({ settings, onChange }: DriverPaySettingsEditorProps) {
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'base' | 'foodCost';
    index: number;
  } | null>(null);

  const update = (field: string, value: unknown) => {
    onChange({ ...settings, [field]: value });
  };

  // ---- Driver Base Pay Tiers ----
  const basePayTiers = settings.driverBasePayTiers ?? [];
  const hasBasePayTiers = basePayTiers.length > 0;

  const updateBasePayTier = (index: number, field: string, value: unknown) => {
    const updated = [...basePayTiers];
    const tier = updated[index];
    if (!tier) return;
    updated[index] = { ...tier, [field]: value };
    update('driverBasePayTiers', updated);
  };

  const addBasePayTier = () => {
    const last = basePayTiers[basePayTiers.length - 1];
    const newMin = last?.headcountMax != null ? last.headcountMax + 1 : 0;
    update('driverBasePayTiers', [
      ...basePayTiers,
      { headcountMin: newMin, headcountMax: null, basePay: 0 },
    ]);
  };

  const removeBasePayTier = (index: number) => {
    if (basePayTiers.length > 1) {
      setDeleteTarget({ type: 'base', index });
    } else {
      update('driverBasePayTiers', undefined);
    }
  };

  // ---- Driver Food Cost Pay Tiers ----
  const foodCostTiers = settings.driverFoodCostPayTiers ?? [];
  const hasFoodCostTiers = foodCostTiers.length > 0;

  const updateFoodCostTier = (index: number, field: string, value: unknown) => {
    const updated = [...foodCostTiers];
    const tier = updated[index];
    if (!tier) return;
    updated[index] = { ...tier, [field]: value };
    update('driverFoodCostPayTiers', updated);
  };

  const addFoodCostTier = () => {
    const last = foodCostTiers[foodCostTiers.length - 1];
    const newMin = last?.foodCostMax != null ? last.foodCostMax + 0.01 : 0;
    update('driverFoodCostPayTiers', [
      ...foodCostTiers,
      { foodCostMin: Math.round(newMin * 100) / 100, foodCostMax: null, basePay: 0 },
    ]);
  };

  const removeFoodCostTier = (index: number) => {
    if (foodCostTiers.length > 1) {
      setDeleteTarget({ type: 'foodCost', index });
    } else {
      update('driverFoodCostPayTiers', undefined);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'base') {
      const updated = basePayTiers.filter((_, i) => i !== deleteTarget.index);
      update('driverBasePayTiers', updated.length > 0 ? updated : undefined);
    } else {
      const updated = foodCostTiers.filter((_, i) => i !== deleteTarget.index);
      update('driverFoodCostPayTiers', updated.length > 0 ? updated : undefined);
    }
    setDeleteTarget(null);
  };

  // ---- Driver Mileage Settings ----
  const mileageSettings = settings.driverMileageSettings;
  const hasMileageSettings = !!mileageSettings;

  return (
    <div className="space-y-6">
      {/* Base Settings */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Base Settings</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dp-max-pay">Max Pay Per Drop</Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.maxPayPerDrop !== null}
                onCheckedChange={(checked) => {
                  update('maxPayPerDrop', checked ? settings.basePayPerDrop : null);
                }}
              />
              <span className="text-xs text-slate-500">
                {settings.maxPayPerDrop === null ? 'No cap' : 'Capped'}
              </span>
            </div>
            {settings.maxPayPerDrop !== null && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <Input
                  id="dp-max-pay"
                  type="number"
                  min={0}
                  step="0.01"
                  value={settings.maxPayPerDrop}
                  onChange={(e) => update('maxPayPerDrop', parseFloat(e.target.value) || 0)}
                  className="pl-7"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dp-base-pay">Base Pay Per Drop</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <Input
                id="dp-base-pay"
                type="number"
                min={0}
                step="0.01"
                value={settings.basePayPerDrop}
                onChange={(e) => update('basePayPerDrop', parseFloat(e.target.value) || 0)}
                className="pl-7"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dp-bonus">Bonus Pay</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <Input
                id="dp-bonus"
                type="number"
                min={0}
                step="0.01"
                value={settings.bonusPay}
                onChange={(e) => update('bonusPay', parseFloat(e.target.value) || 0)}
                className="pl-7"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dp-rs-fee">Ready Set Fee</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
              <Input
                id="dp-rs-fee"
                type="number"
                min={0}
                step="0.01"
                value={settings.readySetFee}
                onChange={(e) => update('readySetFee', parseFloat(e.target.value) || 0)}
                className="pl-7"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Driver Base Pay Tiers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Driver Base Pay Tiers (Headcount)</h4>
          {!hasBasePayTiers && (
            <Button variant="outline" size="sm" onClick={addBasePayTier} className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Enable
            </Button>
          )}
        </div>

        {hasBasePayTiers && (
          <div className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">HC Min</TableHead>
                  <TableHead className="text-xs">HC Max</TableHead>
                  <TableHead className="text-xs">Base Pay ($)</TableHead>
                  <TableHead className="text-xs">Within Threshold ($)</TableHead>
                  <TableHead className="text-xs w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {basePayTiers.map((tier, index) => (
                  <TableRow key={index}>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={tier.headcountMin}
                        onChange={(e) => updateBasePayTier(index, 'headcountMin', parseInt(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={tier.headcountMax ?? ''}
                        placeholder="∞"
                        onChange={(e) =>
                          updateBasePayTier(index, 'headcountMax', e.target.value === '' ? null : parseInt(e.target.value) || 0)
                        }
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={tier.basePay}
                        onChange={(e) => updateBasePayTier(index, 'basePay', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={tier.basePayWithinThreshold ?? ''}
                        placeholder="—"
                        onChange={(e) =>
                          updateBasePayTier(
                            index,
                            'basePayWithinThreshold',
                            e.target.value === '' ? undefined : parseFloat(e.target.value) || 0
                          )
                        }
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeBasePayTier(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button variant="outline" size="sm" onClick={addBasePayTier} className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Add Tier
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Driver Food Cost Pay Tiers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Driver Food Cost Pay Tiers</h4>
          {!hasFoodCostTiers && (
            <Button variant="outline" size="sm" onClick={addFoodCostTier} className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Enable
            </Button>
          )}
        </div>

        {hasFoodCostTiers && (
          <div className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Food Cost Min ($)</TableHead>
                  <TableHead className="text-xs">Food Cost Max ($)</TableHead>
                  <TableHead className="text-xs">Base Pay ($)</TableHead>
                  <TableHead className="text-xs">Within Threshold ($)</TableHead>
                  <TableHead className="text-xs w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {foodCostTiers.map((tier, index) => (
                  <TableRow key={index}>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={tier.foodCostMin}
                        onChange={(e) => updateFoodCostTier(index, 'foodCostMin', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={tier.foodCostMax ?? ''}
                        placeholder="∞"
                        onChange={(e) =>
                          updateFoodCostTier(index, 'foodCostMax', e.target.value === '' ? null : parseFloat(e.target.value) || 0)
                        }
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={tier.basePay}
                        onChange={(e) => updateFoodCostTier(index, 'basePay', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={tier.basePayWithinThreshold ?? ''}
                        placeholder="—"
                        onChange={(e) =>
                          updateFoodCostTier(
                            index,
                            'basePayWithinThreshold',
                            e.target.value === '' ? undefined : parseFloat(e.target.value) || 0
                          )
                        }
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeFoodCostTier(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button variant="outline" size="sm" onClick={addFoodCostTier} className="gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Add Tier
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Driver Mileage Settings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700">Driver Mileage Settings</h4>
          <Switch
            checked={hasMileageSettings}
            onCheckedChange={(checked) => {
              if (checked) {
                update('driverMileageSettings', {
                  flatAmountWithinThreshold: 7,
                  perMileRateOverThreshold: 0.7,
                });
              } else {
                update('driverMileageSettings', undefined);
              }
            }}
          />
        </div>

        {hasMileageSettings && mileageSettings && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dm-flat">Flat Amount (within threshold)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <Input
                  id="dm-flat"
                  type="number"
                  min={0}
                  step="0.01"
                  value={mileageSettings.flatAmountWithinThreshold}
                  onChange={(e) =>
                    update('driverMileageSettings', {
                      ...mileageSettings,
                      flatAmountWithinThreshold: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dm-rate">Per Mile Rate (over threshold)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                <Input
                  id="dm-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={mileageSettings.perMileRateOverThreshold}
                  onChange={(e) =>
                    update('driverMileageSettings', {
                      ...mileageSettings,
                      perMileRateOverThreshold: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="pl-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">/mi</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dm-threshold">Threshold</Label>
              <div className="relative">
                <Input
                  id="dm-threshold"
                  type="number"
                  min={0}
                  step="0.1"
                  value={mileageSettings.threshold ?? ''}
                  placeholder="Uses default"
                  onChange={(e) =>
                    update('driverMileageSettings', {
                      ...mileageSettings,
                      threshold: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">mi</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Custom Driver Mileage Rate */}
      <div className="space-y-2">
        <Label htmlFor="dp-mileage-rate">Custom Driver Mileage Rate (optional override)</Label>
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          <Input
            id="dp-mileage-rate"
            type="number"
            min={0}
            step="0.01"
            value={settings.driverMileageRate ?? ''}
            placeholder="Default ($0.35/mi)"
            onChange={(e) =>
              update('driverMileageRate', e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)
            }
            className="pl-7"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">/mi</span>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Tier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this{' '}
              {deleteTarget?.type === 'base' ? 'base pay' : 'food cost pay'} tier?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
