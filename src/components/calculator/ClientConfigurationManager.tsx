/**
 * Client Configuration Manager
 * UI component for managing delivery calculator configurations
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Settings,
  Save,
  Plus,
  Copy,
  Download,
  Upload,
  Trash2,
  Check,
  AlertTriangle,
  Edit,
  DollarSign,
  TrendingUp,
  Truck,
  MapPin
} from 'lucide-react';

import {
  ClientDeliveryConfiguration,
  getActiveConfigurations,
  getConfiguration,
  validateConfiguration,
  exportConfiguration,
  importConfiguration,
  cloneConfiguration,
  READY_SET_FOOD_STANDARD
} from '@/lib/calculator/client-configurations';
import { PricingTier } from '@/lib/calculator/delivery-cost-calculator';

interface ClientConfigurationManagerProps {
  onConfigurationChange?: (config: ClientDeliveryConfiguration) => void;
  currentConfigId?: string;
}

export function ClientConfigurationManager({
  onConfigurationChange,
  currentConfigId
}: ClientConfigurationManagerProps) {
  const [configurations, setConfigurations] = useState<ClientDeliveryConfiguration[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ClientDeliveryConfiguration | null>(null);
  const [editingConfig, setEditingConfig] = useState<ClientDeliveryConfiguration | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] }>({ valid: true, errors: [] });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load configurations on mount
  useEffect(() => {
    loadConfigurations();
  }, []);

  // Load current config if provided
  useEffect(() => {
    if (currentConfigId) {
      loadConfigById(currentConfigId);
    } else {
      // Default to Ready Set Food Standard
      setSelectedConfig(READY_SET_FOOD_STANDARD);
      setEditingConfig(JSON.parse(JSON.stringify(READY_SET_FOOD_STANDARD)));
    }
  }, [currentConfigId]);

  const loadConfigurations = async () => {
    try {
      const response = await fetch('/api/calculator/configurations');
      const result = await response.json();

      if (result.success && result.data) {
        setConfigurations(result.data);
      } else {
        // Fallback to in-memory configurations
        const configs = getActiveConfigurations();
        setConfigurations(configs);
      }
    } catch (error) {
      console.error('Failed to load configurations:', error);
      // Fallback to in-memory configurations
      const configs = getActiveConfigurations();
      setConfigurations(configs);
    }
  };

  const loadConfigById = async (configId: string) => {
    try {
      const response = await fetch(`/api/calculator/configurations?id=${configId}`);
      const result = await response.json();

      if (result.success && result.data) {
        setSelectedConfig(result.data);
        setEditingConfig(JSON.parse(JSON.stringify(result.data)));
      } else {
        // Fallback to in-memory configuration
        const config = getConfiguration(configId);
        if (config) {
          setSelectedConfig(config);
          setEditingConfig(JSON.parse(JSON.stringify(config)));
        }
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      // Fallback to in-memory configuration
      const config = getConfiguration(configId);
      if (config) {
        setSelectedConfig(config);
        setEditingConfig(JSON.parse(JSON.stringify(config)));
      }
    }
  };

  const handleConfigSelect = async (configId: string) => {
    try {
      const response = await fetch(`/api/calculator/configurations?id=${configId}`);
      const result = await response.json();

      let config;
      if (result.success && result.data) {
        config = result.data;
      } else {
        // Fallback to in-memory configuration
        config = getConfiguration(configId);
      }

      if (config) {
        const clonedConfig = JSON.parse(JSON.stringify(config));
        setSelectedConfig(config);
        setEditingConfig(clonedConfig);
        setValidation({ valid: true, errors: [] });
        setSaveSuccess(false);
        setActiveTab('overview'); // Reset to overview tab when changing configs

        if (onConfigurationChange) {
          onConfigurationChange(clonedConfig);
        }
      }
    } catch (error) {
      console.error('Failed to select configuration:', error);
      // Fallback to in-memory configuration
      const config = getConfiguration(configId);
      if (config) {
        const clonedConfig = JSON.parse(JSON.stringify(config));
        setSelectedConfig(config);
        setEditingConfig(clonedConfig);
        setValidation({ valid: true, errors: [] });
        setSaveSuccess(false);
        setActiveTab('overview');

        if (onConfigurationChange) {
          onConfigurationChange(clonedConfig);
        }
      }
    }
  };

  const handleFieldChange = (field: keyof ClientDeliveryConfiguration, value: any) => {
    if (!editingConfig) return;

    const updated = { ...editingConfig, [field]: value, updatedAt: new Date() };
    setEditingConfig(updated);

    // Validate on change
    const validation = validateConfiguration(updated);
    setValidation(validation);
  };

  const handleNestedFieldChange = (parent: keyof ClientDeliveryConfiguration, field: string, value: any) => {
    if (!editingConfig) return;

    const updated = {
      ...editingConfig,
      [parent]: {
        ...(editingConfig[parent] as any),
        [field]: value
      },
      updatedAt: new Date()
    };
    setEditingConfig(updated);

    const validation = validateConfiguration(updated);
    setValidation(validation);
  };

  const handleTierChange = (index: number, field: string, value: any) => {
    if (!editingConfig) return;

    const updatedTiers = [...editingConfig.pricingTiers];
    updatedTiers[index] = { ...updatedTiers[index], [field]: value } as PricingTier;

    const updated = { ...editingConfig, pricingTiers: updatedTiers, updatedAt: new Date() };
    setEditingConfig(updated);

    const validation = validateConfiguration(updated);
    setValidation(validation);
  };

  const handleSave = async () => {
    if (!editingConfig || !validation.valid) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/calculator/configurations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingConfig),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save configuration');
      }

      setSelectedConfig(result.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Reload configurations list
      await loadConfigurations();

      if (onConfigurationChange) {
        onConfigurationChange(result.data);
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setValidation({
        valid: false,
        errors: ['Failed to save configuration to database']
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (!editingConfig) return;

    const json = exportConfiguration(editingConfig);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editingConfig.id}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const imported = importConfiguration(json);
        setEditingConfig(imported);

        const validation = validateConfiguration(imported);
        setValidation(validation);
      } catch (error) {
        console.error('Failed to import configuration:', error);
        setValidation({
          valid: false,
          errors: ['Failed to import configuration: Invalid format']
        });
      }
    };
    reader.readAsText(file);
  };

  const handleClone = () => {
    if (!selectedConfig) return;

    const cloned = cloneConfiguration(selectedConfig.id, `${selectedConfig.clientName} (Copy)`);
    setEditingConfig(cloned);
    setValidation({ valid: true, errors: [] });
  };

  if (!editingConfig) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-md">
              <Settings className="h-5 w-5 text-white" />
            </div>
            Client Configuration Settings
          </h2>
          <p className="text-slate-600 mt-1">Manage delivery pricing configurations and rates</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClone}>
            <Copy className="h-4 w-4 mr-2" />
            Clone
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
          </label>
        </div>
      </div>

      {/* Configuration Selector */}
      <Card className="border-0 shadow-lg rounded-2xl bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Select Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="config-select">Active Configuration</Label>
              <Select
                value={selectedConfig?.id || editingConfig.id}
                onValueChange={handleConfigSelect}
              >
                <SelectTrigger id="config-select" className="h-11">
                  <SelectValue placeholder="Select a configuration" />
                </SelectTrigger>
                <SelectContent>
                  {configurations.map(config => (
                    <SelectItem key={config.id} value={config.id}>
                      <div className="flex items-center gap-2">
                        <span>{config.clientName}</span>
                        {config.isActive && (
                          <Badge variant="default" className="ml-2">Active</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedConfig && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">{selectedConfig.clientName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Vendor: {selectedConfig.vendorName}</p>
                    <p className="text-sm text-slate-600 mt-1">{selectedConfig.description}</p>
                  </div>
                  {selectedConfig.isActive && (
                    <Badge variant="default" className="bg-emerald-500">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Alerts */}
      {!validation.valid && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="font-semibold mb-1">Configuration has errors:</div>
            <ul className="list-disc list-inside space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index} className="text-sm">{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Configuration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg rounded-2xl bg-white mb-4">
          <CardContent className="p-2">
            <TabsList className="grid w-full grid-cols-4 bg-slate-50 p-1.5 rounded-xl h-auto">
              <TabsTrigger
                value="overview"
                className="rounded-lg px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-md"
              >
                <Settings className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="pricing"
                className="rounded-lg px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-md"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Pricing Tiers
              </TabsTrigger>
              <TabsTrigger
                value="rates"
                className="rounded-lg px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-md"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Rates & Fees
              </TabsTrigger>
              <TabsTrigger
                value="driver"
                className="rounded-lg px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-md"
              >
                <Truck className="h-4 w-4 mr-2" />
                Driver Pay
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-0">
          <Card className="border-0 shadow-lg rounded-2xl bg-white">
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>General configuration details and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client-name">Client Name *</Label>
                  <Input
                    id="client-name"
                    value={editingConfig.clientName}
                    onChange={(e) => handleFieldChange('clientName', e.target.value)}
                    placeholder="e.g., Ready Set Food - Standard"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendor-name">Vendor Name *</Label>
                  <Input
                    id="vendor-name"
                    value={editingConfig.vendorName}
                    onChange={(e) => handleFieldChange('vendorName', e.target.value)}
                    placeholder="e.g., Destino"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="config-id">Configuration ID</Label>
                <Input
                  id="config-id"
                  value={editingConfig.id}
                  onChange={(e) => handleFieldChange('id', e.target.value)}
                  placeholder="e.g., ready-set-food-standard"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editingConfig.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Describe this configuration..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editingConfig.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg">
                <Switch
                  id="is-active"
                  checked={editingConfig.isActive}
                  onCheckedChange={(checked) => handleFieldChange('isActive', checked)}
                />
                <Label htmlFor="is-active" className="cursor-pointer">
                  Configuration is Active
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Tiers Tab */}
        <TabsContent value="pricing" className="space-y-4 mt-0">
          <Card className="border-0 shadow-lg rounded-2xl bg-white">
            <CardHeader>
              <CardTitle>Pricing Tiers</CardTitle>
              <CardDescription>
                Configure delivery costs based on headcount and food cost ranges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-800">
                    <strong>Note:</strong> Delivery cost is calculated using the LESSER of headcount OR food cost (conservative approach).
                    Regular Rate applies to deliveries over {editingConfig.distanceThreshold} miles,
                    Within 10 Miles rate applies to shorter distances.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  {editingConfig.pricingTiers.map((tier, index) => (
                    <Card key={index} className="border border-slate-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center justify-between">
                          <span>Tier {index + 1}</span>
                          <Badge variant="outline">
                            {tier.headcountMin}-{tier.headcountMax || '∞'} people /
                            ${tier.foodCostMin}-${tier.foodCostMax || '∞'}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Headcount Min</Label>
                            <Input
                              type="number"
                              value={tier.headcountMin}
                              onChange={(e) => handleTierChange(index, 'headcountMin', parseInt(e.target.value) || 0)}
                              className="h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Headcount Max</Label>
                            <Input
                              type="number"
                              value={tier.headcountMax || ''}
                              onChange={(e) => handleTierChange(index, 'headcountMax', e.target.value ? parseInt(e.target.value) : null)}
                              placeholder="∞"
                              className="h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Food Cost Min ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={tier.foodCostMin}
                              onChange={(e) => handleTierChange(index, 'foodCostMin', parseFloat(e.target.value) || 0)}
                              className="h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Food Cost Max ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={tier.foodCostMax || ''}
                              onChange={(e) => handleTierChange(index, 'foodCostMax', e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="∞"
                              className="h-9"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-blue-600">Regular Rate ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={tier.regularRate}
                              onChange={(e) => handleTierChange(index, 'regularRate', parseFloat(e.target.value) || 0)}
                              className="h-9 border-blue-300 focus:border-blue-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-emerald-600">Within 10 Miles ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={tier.within10Miles}
                              onChange={(e) => handleTierChange(index, 'within10Miles', parseFloat(e.target.value) || 0)}
                              className="h-9 border-emerald-300 focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rates & Fees Tab */}
        <TabsContent value="rates" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mileage Settings */}
            <Card className="border-0 shadow-lg rounded-2xl bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Mileage Settings
                </CardTitle>
                <CardDescription>Configure mileage rates and distance thresholds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mileage-rate">Mileage Rate ($/mile) *</Label>
                  <Input
                    id="mileage-rate"
                    type="number"
                    step="0.01"
                    value={editingConfig.mileageRate}
                    onChange={(e) => handleFieldChange('mileageRate', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-slate-500">
                    Rate charged per mile over distance threshold
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distance-threshold">Distance Threshold (miles) *</Label>
                  <Input
                    id="distance-threshold"
                    type="number"
                    step="0.1"
                    value={editingConfig.distanceThreshold}
                    onChange={(e) => handleFieldChange('distanceThreshold', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-slate-500">
                    Miles included in base rate (typically 10)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Bridge Toll Settings */}
            <Card className="border-0 shadow-lg rounded-2xl bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                  Bridge Toll Settings
                </CardTitle>
                <CardDescription>Configure bridge crossing charges</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bridge-toll">Default Toll Amount ($) *</Label>
                  <Input
                    id="bridge-toll"
                    type="number"
                    step="0.01"
                    value={editingConfig.bridgeTollSettings.defaultTollAmount}
                    onChange={(e) => handleNestedFieldChange('bridgeTollSettings', 'defaultTollAmount', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-apply-areas">Auto-Apply Areas (comma-separated)</Label>
                  <Input
                    id="auto-apply-areas"
                    value={editingConfig.bridgeTollSettings.autoApplyForAreas?.join(', ') || ''}
                    onChange={(e) => handleNestedFieldChange(
                      'bridgeTollSettings',
                      'autoApplyForAreas',
                      e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    )}
                    placeholder="San Francisco, Oakland, Berkeley"
                  />
                  <p className="text-xs text-slate-500">
                    Areas that automatically include bridge toll
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Daily Drive Discounts */}
            <Card className="border-0 shadow-lg rounded-2xl bg-white md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Daily Drive Discounts
                </CardTitle>
                <CardDescription>Discounts per drive based on daily volume</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="two-drivers">2 Drives/Day ($/drive) *</Label>
                    <Input
                      id="two-drivers"
                      type="number"
                      step="0.01"
                      value={editingConfig.dailyDriveDiscounts.twoDrivers}
                      onChange={(e) => handleNestedFieldChange('dailyDriveDiscounts', 'twoDrivers', parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-500">Discount for 2 deliveries per day</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="three-drivers">3 Drives/Day ($/drive) *</Label>
                    <Input
                      id="three-drivers"
                      type="number"
                      step="0.01"
                      value={editingConfig.dailyDriveDiscounts.threeDrivers}
                      onChange={(e) => handleNestedFieldChange('dailyDriveDiscounts', 'threeDrivers', parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-500">Discount for 3 deliveries per day</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="four-drivers">4+ Drives/Day ($/drive) *</Label>
                    <Input
                      id="four-drivers"
                      type="number"
                      step="0.01"
                      value={editingConfig.dailyDriveDiscounts.fourPlusDrivers}
                      onChange={(e) => handleNestedFieldChange('dailyDriveDiscounts', 'fourPlusDrivers', parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-500">Discount for 4 or more deliveries per day</p>
                  </div>
                </div>

                <Alert className="mt-4 bg-amber-50 border-amber-200">
                  <AlertDescription className="text-amber-800">
                    <strong>Calculation:</strong> Total discount = (discount per drive) × (number of drives)
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Driver Pay Tab */}
        <TabsContent value="driver" className="space-y-4 mt-0">
          <Card className="border-0 shadow-lg rounded-2xl bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-purple-600" />
                Driver Payment Settings
              </CardTitle>
              <CardDescription>Configure driver compensation structure</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="max-pay">Max Pay Per Drop ($) *</Label>
                    <Input
                      id="max-pay"
                      type="number"
                      step="0.01"
                      value={editingConfig.driverPaySettings.maxPayPerDrop}
                      onChange={(e) => handleNestedFieldChange('driverPaySettings', 'maxPayPerDrop', parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-500">
                      Maximum driver earnings per delivery (cap)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="base-pay">Base Pay Per Drop ($) *</Label>
                    <Input
                      id="base-pay"
                      type="number"
                      step="0.01"
                      value={editingConfig.driverPaySettings.basePayPerDrop}
                      onChange={(e) => handleNestedFieldChange('driverPaySettings', 'basePayPerDrop', parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-500">
                      Base payment before bonuses
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bonus-pay">Bonus Pay ($) *</Label>
                    <Input
                      id="bonus-pay"
                      type="number"
                      step="0.01"
                      value={editingConfig.driverPaySettings.bonusPay}
                      onChange={(e) => handleNestedFieldChange('driverPaySettings', 'bonusPay', parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-500">
                      Additional pay when bonus qualified
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ready-set-fee">Ready Set Fee ($) *</Label>
                    <Input
                      id="ready-set-fee"
                      type="number"
                      step="0.01"
                      value={editingConfig.driverPaySettings.readySetFee}
                      onChange={(e) => handleNestedFieldChange('driverPaySettings', 'readySetFee', parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-slate-500">
                      Platform service fee
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <h4 className="font-semibold text-slate-900">Driver Pay Calculation</h4>
                <div className="p-4 bg-slate-50 rounded-lg space-y-2 font-mono text-sm">
                  <div className="flex justify-between">
                    <span>Base Pay:</span>
                    <span className="font-semibold">${editingConfig.driverPaySettings.basePayPerDrop.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>+ Bonus (if qualified):</span>
                    <span className="font-semibold">+${editingConfig.driverPaySettings.bonusPay.toFixed(2)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between">
                    <span>Uncapped Total:</span>
                    <span className="font-semibold">
                      ${(editingConfig.driverPaySettings.basePayPerDrop + editingConfig.driverPaySettings.bonusPay).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>Capped at Max:</span>
                    <span className="font-semibold">
                      ${Math.min(
                        editingConfig.driverPaySettings.basePayPerDrop + editingConfig.driverPaySettings.bonusPay,
                        editingConfig.driverPaySettings.maxPayPerDrop
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Actions */}
      <Card className="border-0 shadow-lg rounded-2xl bg-white sticky bottom-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!validation.valid && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {validation.errors.length} Error{validation.errors.length !== 1 ? 's' : ''}
                </Badge>
              )}
              {saveSuccess && (
                <Badge variant="default" className="bg-emerald-500 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Saved Successfully
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedConfig) {
                    setEditingConfig(JSON.parse(JSON.stringify(selectedConfig)));
                    setValidation({ valid: true, errors: [] });
                  }
                }}
              >
                Reset Changes
              </Button>
              <Button
                onClick={handleSave}
                disabled={!validation.valid || isSaving}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
