'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { PricingTier } from '@/lib/calculator/delivery-cost-calculator';

interface PricingTiersEditorProps {
  tiers: PricingTier[];
  onChange: (tiers: PricingTier[]) => void;
}

function validateTierRanges(tiers: PricingTier[]): string[] {
  const warnings: string[] = [];
  if (tiers.length < 2) return warnings;

  const sorted = [...tiers].sort((a, b) => a.headcountMin - b.headcountMin);
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (!current || !next) continue;

    if (current.headcountMax !== null && next.headcountMin > current.headcountMax + 1) {
      warnings.push(
        `Gap: headcount ${current.headcountMax + 1}–${next.headcountMin - 1} has no tier`
      );
    }
    if (current.headcountMax !== null && current.headcountMax >= next.headcountMin) {
      warnings.push(
        `Overlap: Tier ${i + 1} (${current.headcountMin}–${current.headcountMax}) overlaps Tier ${i + 2} (${next.headcountMin}–${next.headcountMax ?? '∞'})`
      );
    }
  }
  return warnings;
}

export function PricingTiersEditor({ tiers, onChange }: PricingTiersEditorProps) {
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const warnings = validateTierRanges(tiers);

  const handleCellChange = (index: number, field: keyof PricingTier, value: string) => {
    const updated = [...tiers];
    const tier = updated[index];
    if (!tier) return;

    if (field === 'headcountMax' || field === 'foodCostMax') {
      updated[index] = { ...tier, [field]: value === '' ? null : parseFloat(value) || 0 };
    } else {
      updated[index] = { ...tier, [field]: parseFloat(value) || 0 };
    }
    onChange(updated);
  };

  const handlePercentToggle = (index: number, usePercent: boolean) => {
    const updated = [...tiers];
    const tier = updated[index];
    if (!tier) return;

    if (usePercent) {
      updated[index] = {
        ...tier,
        regularRatePercent: tier.regularRatePercent ?? 0.1,
        within10MilesPercent: tier.within10MilesPercent ?? 0.1,
      };
    } else {
      const { regularRatePercent: _r, within10MilesPercent: _w, ...rest } = tier;
      updated[index] = rest as PricingTier;
    }
    onChange(updated);
  };

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newMin = lastTier?.headcountMax != null ? lastTier.headcountMax + 1 : 0;
    const newFoodMin = lastTier?.foodCostMax != null ? lastTier.foodCostMax + 0.01 : 0;
    const newTier: PricingTier = {
      headcountMin: newMin,
      headcountMax: null,
      foodCostMin: Math.round(newFoodMin * 100) / 100,
      foodCostMax: null,
      regularRate: lastTier?.regularRate ?? 0,
      within10Miles: lastTier?.within10Miles ?? 0,
    };
    onChange([...tiers, newTier]);
  };

  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      setDeleteIndex(index);
    }
  };

  const confirmRemove = () => {
    if (deleteIndex !== null) {
      onChange(tiers.filter((_, i) => i !== deleteIndex));
      setDeleteIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            {warnings.map((w, i) => (
              <div key={i} className="text-sm">{w}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-20">HC Min</TableHead>
              <TableHead className="text-xs w-20">HC Max</TableHead>
              <TableHead className="text-xs w-24">Food Min ($)</TableHead>
              <TableHead className="text-xs w-24">Food Max ($)</TableHead>
              <TableHead className="text-xs w-24">Regular ($)</TableHead>
              <TableHead className="text-xs w-24">≤10mi ($)</TableHead>
              <TableHead className="text-xs w-16">%</TableHead>
              <TableHead className="text-xs w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((tier, index) => {
              const isPercent = tier.regularRatePercent !== undefined || tier.within10MilesPercent !== undefined;
              return (
                <TableRow key={index}>
                  <TableCell className="p-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={tier.headcountMin}
                      onChange={(e) => handleCellChange(index, 'headcountMin', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell className="p-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={tier.headcountMax ?? ''}
                      placeholder="∞"
                      onChange={(e) => handleCellChange(index, 'headcountMax', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell className="p-1.5">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={tier.foodCostMin}
                      onChange={(e) => handleCellChange(index, 'foodCostMin', e.target.value)}
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
                      onChange={(e) => handleCellChange(index, 'foodCostMax', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell className="p-1.5">
                    {isPercent ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={1}
                          step="0.01"
                          value={tier.regularRatePercent ?? 0}
                          onChange={(e) => handleCellChange(index, 'regularRatePercent', e.target.value)}
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={tier.regularRate}
                        onChange={(e) => handleCellChange(index, 'regularRate', e.target.value)}
                        className="h-8 text-sm"
                      />
                    )}
                  </TableCell>
                  <TableCell className="p-1.5">
                    {isPercent ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={1}
                          step="0.01"
                          value={tier.within10MilesPercent ?? 0}
                          onChange={(e) => handleCellChange(index, 'within10MilesPercent', e.target.value)}
                          className="h-8 text-sm"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={tier.within10Miles}
                        onChange={(e) => handleCellChange(index, 'within10Miles', e.target.value)}
                        className="h-8 text-sm"
                      />
                    )}
                  </TableCell>
                  <TableCell className="p-1.5">
                    <div className="flex items-center">
                      <Switch
                        checked={isPercent}
                        onCheckedChange={(checked) => handlePercentToggle(index, checked)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="p-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeTier(index)}
                      disabled={tiers.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Button variant="outline" size="sm" onClick={addTier} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Tier
      </Button>

      {isPercent(tiers) && (
        <p className="text-xs text-slate-500">
          Percentage tiers use a fraction of food cost (e.g., 0.10 = 10%).
        </p>
      )}

      <AlertDialog open={deleteIndex !== null} onOpenChange={() => setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Pricing Tier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this pricing tier? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function isPercent(tiers: PricingTier[]): boolean {
  return tiers.some(t => t.regularRatePercent !== undefined || t.within10MilesPercent !== undefined);
}
