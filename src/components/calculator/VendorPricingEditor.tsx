'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  ClientDeliveryConfiguration,
  validateConfiguration,
} from '@/lib/calculator/client-configurations';
import {
  PricingTiersEditor,
  DriverPaySettingsEditor,
  BridgeTollEditor,
  ZeroOrderSettingsEditor,
  AdvancedFlagsEditor,
} from '@/components/calculator/vendor-pricing';

interface VendorPricingEditorProps {
  config: ClientDeliveryConfiguration;
  onSave: (config: ClientDeliveryConfiguration) => Promise<void>;
  isSaving: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function VendorPricingEditor({
  config,
  onSave,
  isSaving,
  onDirtyChange,
}: VendorPricingEditorProps) {
  const [editingConfig, setEditingConfig] = useState<ClientDeliveryConfiguration>(
    () => JSON.parse(JSON.stringify(config))
  );
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] }>({
    valid: true,
    errors: [],
  });
  const originalRef = useRef<string>(JSON.stringify(config));

  // Reset editing state when config prop changes (new vendor selected)
  useEffect(() => {
    const serialized = JSON.stringify(config);
    originalRef.current = serialized;
    setEditingConfig(JSON.parse(serialized));
    setValidation({ valid: true, errors: [] });
  }, [config]);

  const isDirty = !deepEqual(
    JSON.parse(originalRef.current),
    editingConfig
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const runValidation = useCallback((updated: ClientDeliveryConfiguration) => {
    const result = validateConfiguration(updated);
    setValidation(result);
  }, []);

  const updateConfig = useCallback(
    (updater: (prev: ClientDeliveryConfiguration) => ClientDeliveryConfiguration) => {
      setEditingConfig((prev) => {
        const updated = { ...updater(prev), updatedAt: new Date() };
        runValidation(updated);
        return updated;
      });
    },
    [runValidation]
  );

  const handleFieldChange = (field: keyof ClientDeliveryConfiguration, value: unknown) => {
    updateConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setEditingConfig(JSON.parse(originalRef.current));
    setValidation({ valid: true, errors: [] });
  };

  const handleSave = () => {
    onSave(editingConfig);
  };

  // Categorize errors per section
  const sectionErrors: Record<string, string[]> = {};
  for (const err of validation.errors) {
    const lower = err.toLowerCase();
    if (lower.includes('client name') || lower.includes('vendor name')) {
      (sectionErrors['general'] ??= []).push(err);
    } else if (lower.includes('tier') && !lower.includes('driver')) {
      (sectionErrors['pricing'] ??= []).push(err);
    } else if (lower.includes('mileage rate') || lower.includes('distance threshold')) {
      (sectionErrors['mileage'] ??= []).push(err);
    } else if (lower.includes('daily drive') || lower.includes('discount')) {
      (sectionErrors['discounts'] ??= []).push(err);
    } else if (lower.includes('driver') || lower.includes('bonus') || lower.includes('ready set fee') || lower.includes('max pay')) {
      (sectionErrors['driver'] ??= []).push(err);
    } else if (lower.includes('toll') || lower.includes('bridge')) {
      (sectionErrors['bridge'] ??= []).push(err);
    } else {
      (sectionErrors['general'] ??= []).push(err);
    }
  }

  const ErrorBadge = ({ section }: { section: string }) => {
    const count = sectionErrors[section]?.length ?? 0;
    if (count === 0) return null;
    return (
      <Badge variant="destructive" className="ml-2 text-xs px-1.5 py-0.5">
        {count}
      </Badge>
    );
  };

  const SectionErrors = ({ section }: { section: string }) => {
    const errors = sectionErrors[section];
    if (!errors || errors.length === 0) return null;
    return (
      <Alert className="border-red-200 bg-red-50 mt-3">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800 text-sm">
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </AlertDescription>
      </Alert>
    );
  };

  const showZeroOrder =
    editingConfig.zeroOrderSettings !== undefined ||
    editingConfig.vendorName?.toLowerCase().includes('hy food');

  return (
    <div className="space-y-4 pb-24">
      <Card className="border-0 shadow-lg rounded-2xl bg-white">
        <CardContent className="p-0">
          <Accordion type="multiple" defaultValue={['general']} className="divide-y divide-slate-200">
            {/* General Info */}
            <AccordionItem value="general" className="border-0 px-6">
              <AccordionTrigger className="text-base font-semibold text-slate-800 hover:no-underline">
                General Info
                <ErrorBadge section="general" />
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vp-client-name">Client Name *</Label>
                    <Input
                      id="vp-client-name"
                      value={editingConfig.clientName}
                      onChange={(e) => handleFieldChange('clientName', e.target.value)}
                      placeholder="e.g., Ready Set Food - Standard"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vp-vendor-name">Vendor Name *</Label>
                    <Input
                      id="vp-vendor-name"
                      value={editingConfig.vendorName}
                      onChange={(e) => handleFieldChange('vendorName', e.target.value)}
                      placeholder="e.g., Destino"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="vp-description">Description</Label>
                    <Input
                      id="vp-description"
                      value={editingConfig.description ?? ''}
                      onChange={(e) => handleFieldChange('description', e.target.value || undefined)}
                      placeholder="Short description..."
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="vp-notes">Notes</Label>
                    <Textarea
                      id="vp-notes"
                      value={editingConfig.notes ?? ''}
                      onChange={(e) => handleFieldChange('notes', e.target.value || undefined)}
                      placeholder="Internal notes..."
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 sm:col-span-2">
                    <Switch
                      id="vp-active"
                      checked={editingConfig.isActive}
                      onCheckedChange={(checked) => handleFieldChange('isActive', checked)}
                    />
                    <Label htmlFor="vp-active" className="cursor-pointer font-medium">
                      Configuration is Active
                    </Label>
                  </div>
                </div>
                <SectionErrors section="general" />
              </AccordionContent>
            </AccordionItem>

            {/* Pricing Tiers */}
            <AccordionItem value="pricing" className="border-0 px-6">
              <AccordionTrigger className="text-base font-semibold text-slate-800 hover:no-underline">
                Pricing Tiers
                <ErrorBadge section="pricing" />
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <PricingTiersEditor
                  tiers={editingConfig.pricingTiers}
                  onChange={(tiers) => handleFieldChange('pricingTiers', tiers)}
                />
                <SectionErrors section="pricing" />
              </AccordionContent>
            </AccordionItem>

            {/* Mileage & Distance */}
            <AccordionItem value="mileage" className="border-0 px-6">
              <AccordionTrigger className="text-base font-semibold text-slate-800 hover:no-underline">
                Mileage & Distance
                <ErrorBadge section="mileage" />
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vp-mileage-rate">Mileage Rate</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                      <Input
                        id="vp-mileage-rate"
                        type="number"
                        min={0}
                        step="0.01"
                        value={editingConfig.mileageRate}
                        onChange={(e) =>
                          handleFieldChange('mileageRate', parseFloat(e.target.value) || 0)
                        }
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vp-distance-threshold">Distance Threshold</Label>
                    <div className="relative">
                      <Input
                        id="vp-distance-threshold"
                        type="number"
                        min={0}
                        step="0.1"
                        value={editingConfig.distanceThreshold}
                        onChange={(e) =>
                          handleFieldChange('distanceThreshold', parseFloat(e.target.value) || 0)
                        }
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                        miles
                      </span>
                    </div>
                  </div>
                </div>
                <SectionErrors section="mileage" />
              </AccordionContent>
            </AccordionItem>

            {/* Daily Drive Discounts */}
            <AccordionItem value="discounts" className="border-0 px-6">
              <AccordionTrigger className="text-base font-semibold text-slate-800 hover:no-underline">
                Daily Drive Discounts
                <ErrorBadge section="discounts" />
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vp-dd-two">2 Drives/Day</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                      <Input
                        id="vp-dd-two"
                        type="number"
                        min={0}
                        step="0.01"
                        value={editingConfig.dailyDriveDiscounts.twoDrivers}
                        onChange={(e) =>
                          updateConfig((prev) => ({
                            ...prev,
                            dailyDriveDiscounts: {
                              ...prev.dailyDriveDiscounts,
                              twoDrivers: parseFloat(e.target.value) || 0,
                            },
                          }))
                        }
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vp-dd-three">3 Drives/Day</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                      <Input
                        id="vp-dd-three"
                        type="number"
                        min={0}
                        step="0.01"
                        value={editingConfig.dailyDriveDiscounts.threeDrivers}
                        onChange={(e) =>
                          updateConfig((prev) => ({
                            ...prev,
                            dailyDriveDiscounts: {
                              ...prev.dailyDriveDiscounts,
                              threeDrivers: parseFloat(e.target.value) || 0,
                            },
                          }))
                        }
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vp-dd-four">4+ Drives/Day</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                      <Input
                        id="vp-dd-four"
                        type="number"
                        min={0}
                        step="0.01"
                        value={editingConfig.dailyDriveDiscounts.fourPlusDrivers}
                        onChange={(e) =>
                          updateConfig((prev) => ({
                            ...prev,
                            dailyDriveDiscounts: {
                              ...prev.dailyDriveDiscounts,
                              fourPlusDrivers: parseFloat(e.target.value) || 0,
                            },
                          }))
                        }
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>
                <SectionErrors section="discounts" />
              </AccordionContent>
            </AccordionItem>

            {/* Driver Pay Settings */}
            <AccordionItem value="driver" className="border-0 px-6">
              <AccordionTrigger className="text-base font-semibold text-slate-800 hover:no-underline">
                Driver Pay Settings
                <ErrorBadge section="driver" />
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <DriverPaySettingsEditor
                  settings={editingConfig.driverPaySettings}
                  onChange={(driverPaySettings) =>
                    updateConfig((prev) => ({ ...prev, driverPaySettings }))
                  }
                />
                <SectionErrors section="driver" />
              </AccordionContent>
            </AccordionItem>

            {/* Bridge Toll Settings */}
            <AccordionItem value="bridge" className="border-0 px-6">
              <AccordionTrigger className="text-base font-semibold text-slate-800 hover:no-underline">
                Bridge Toll Settings
                <ErrorBadge section="bridge" />
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <BridgeTollEditor
                  settings={editingConfig.bridgeTollSettings}
                  onChange={(bridgeTollSettings) =>
                    updateConfig((prev) => ({ ...prev, bridgeTollSettings }))
                  }
                />
                <SectionErrors section="bridge" />
              </AccordionContent>
            </AccordionItem>

            {/* Zero Order Settings */}
            {showZeroOrder && (
              <AccordionItem value="zero-order" className="border-0 px-6">
                <AccordionTrigger className="text-base font-semibold text-slate-800 hover:no-underline">
                  Zero Order Settings
                </AccordionTrigger>
                <AccordionContent className="pb-6">
                  <ZeroOrderSettingsEditor
                    settings={editingConfig.zeroOrderSettings}
                    onChange={(zeroOrderSettings) =>
                      updateConfig((prev) => ({ ...prev, zeroOrderSettings }))
                    }
                  />
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Advanced Flags */}
            <AccordionItem value="advanced" className="border-0 px-6">
              <AccordionTrigger className="text-base font-semibold text-slate-800 hover:no-underline">
                Advanced Flags
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <AdvancedFlagsEditor
                  settings={{
                    requiresManualReview: editingConfig.driverPaySettings.requiresManualReview,
                    readySetFeeMatchesDeliveryFee:
                      editingConfig.driverPaySettings.readySetFeeMatchesDeliveryFee,
                    includeDirectTipInReadySetTotal:
                      editingConfig.driverPaySettings.includeDirectTipInReadySetTotal,
                  }}
                  onChange={(field, value) =>
                    updateConfig((prev) => ({
                      ...prev,
                      driverPaySettings: {
                        ...prev.driverPaySettings,
                        [field]: value,
                      },
                    }))
                  }
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 shadow-lg">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!validation.valid && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {validation.errors.length} Error{validation.errors.length !== 1 ? 's' : ''}
              </Badge>
            )}
            {isDirty && validation.valid && (
              <Badge
                variant="secondary"
                className="bg-amber-50 text-amber-700 border-amber-200"
              >
                Unsaved changes
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!isDirty || isSaving}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || !validation.valid || isSaving}
              className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
