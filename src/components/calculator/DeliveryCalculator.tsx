// DeliveryCalculator - Main calculator component with flexible pricing system
// Provides comprehensive delivery cost calculation with real-time updates

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Calculator, DollarSign, Truck, Users, MapPin, Check, Save, Settings, History, AlertTriangle } from 'lucide-react';
import { useCalculatorConfig, useCalculator, useCalculatorHistory } from '@/hooks/useCalculatorConfig';
import { 
  CalculationInput, 
  CalculationResult,
  CalculatorTemplate,
  ClientConfiguration
} from '@/types/calculator';

interface DeliveryCalculatorProps {
  templateId?: string;
  clientConfigId?: string;
  onCalculationComplete?: (result: CalculationResult) => void;
  onSaveCalculation?: (input: CalculationInput, result: CalculationResult) => void;
  className?: string;
}

// Helper function for safe number formatting
const formatCurrency = (value: number | undefined | null): string => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.00';
  }
  return value.toFixed(2);
};

const formatPercent = (value: number | undefined | null): string => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.0';
  }
  return value.toFixed(1);
};

export function DeliveryCalculator({
  templateId,
  clientConfigId,
  onCalculationComplete,
  onSaveCalculation,
  className
}: DeliveryCalculatorProps) {
  // Hook for calculator configuration management
  const { 
    config, 
    templates, 
    clientConfigs,
    isLoading, 
    isLoadingTemplates,
    error: configError,
    loadConfig,
    loadTemplates,
    loadClientConfigs,
    setActiveTemplate,
    setActiveClientConfig,
    clearError
  } = useCalculatorConfig({
    templateId,
    clientConfigId,
    autoLoad: false // ✅ FIXED: Disable auto-load since we manually load config after selecting client config
  });

  // Hook for real-time calculation
  const { 
    result, 
    isCalculating, 
    error: calculationError,
    calculate,
    clearError: clearCalculationError
  } = useCalculator(config);

  // Hook for calculation history
  const { 
    history: savedResults, 
    isLoading: isLoadingHistory, 
    error: historyError,
    loadHistory: reloadHistory,
    clearError: clearHistoryError
  } = useCalculatorHistory({ 
    templateId: config?.template?.id,
    limit: 10,
    autoLoad: true 
  });

  // Form state
  const [input, setInput] = useState<CalculationInput>({
    headcount: 0,
    foodCost: 0,
    mileage: 0,
    requiresBridge: false,
    numberOfStops: 1,
    tips: 0,
    adjustments: 0,
    mileageRate: 0.35,
    deliveryArea: ''
  });

  // UI state
  const [activeTab, setActiveTab] = useState('input');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedClientConfigId, setSelectedClientConfigId] = useState<string | undefined>(clientConfigId);

  // Track if we've already auto-selected a client config to prevent loops
  const hasAutoSelectedClientConfig = useRef(false);
  const hasLoadedClientConfigs = useRef(false);
  const hasLoadedInitialConfig = useRef(false);
  const hasLoadedTemplates = useRef(false);

  // Load templates on mount
  useEffect(() => {
    if (!hasLoadedTemplates.current) {
      hasLoadedTemplates.current = true;
      loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Load initial config when template is available
  useEffect(() => {
    if (templateId && !hasLoadedInitialConfig.current) {
      hasLoadedInitialConfig.current = true;
      loadConfig(templateId);
    }
  }, [templateId]);

  // Auto-calculate when input changes and config is loaded
  useEffect(() => {
    if (config && Object.values(input).some(val => val !== 0 && val !== '')) {
      const timer = setTimeout(() => {
        calculate(input);
      }, 300); // Debounce calculations

      return () => clearTimeout(timer);
    }
  }, [input, config]); // ✅ FIXED: Removed 'calculate' from dependencies to prevent infinite loop

  // Call completion callback when calculation finishes
  useEffect(() => {
    if (result && onCalculationComplete) {
      onCalculationComplete(result);
    }
  }, [result, onCalculationComplete]);

  // Sync local state with loaded config
  useEffect(() => {
    if (config?.clientConfig?.id && config.clientConfig.id !== selectedClientConfigId) {
      setSelectedClientConfigId(config.clientConfig.id);
    }
  }, [config?.clientConfig?.id, selectedClientConfigId]);

  // Load client configs when templates change (only once)
  useEffect(() => {
    if (templates.length > 0 && !hasLoadedClientConfigs.current) {
      hasLoadedClientConfigs.current = true;
      loadClientConfigs();
    }
  }, [templates.length]); // ✅ FIXED: Only depend on templates.length, not the function or array reference

  // Auto-select Ready Set Food - Standard when configs load (only once)
  useEffect(() => {
    if (clientConfigs.length > 0 && !config?.clientConfig && config?.template && !hasAutoSelectedClientConfig.current) {
      const readySetConfig = clientConfigs.find(c => c.clientName === 'Ready Set Food - Standard');
      if (readySetConfig) {
        hasAutoSelectedClientConfig.current = true; // Mark as done to prevent re-runs
        setSelectedClientConfigId(readySetConfig.id); // Update local state
        setActiveClientConfig(readySetConfig.id);
      }
    }
  }, [clientConfigs.length, config?.clientConfig?.id, config?.template?.id]); // ✅ FIXED: Removed function from dependencies, use specific IDs only

  const handleInputChange = (field: keyof CalculationInput, value: any) => {
    setInput(prev => ({ ...prev, [field]: value }));
  };

  const handleTemplateChange = (newTemplateId: string) => {
    setActiveTemplate(newTemplateId);
    clearCalculationError();
  };

  const handleClientConfigChange = (configId: string) => {
    setSelectedClientConfigId(configId); // Update local state immediately
    setActiveClientConfig(configId);
    clearCalculationError();
  };

  const handleSaveCalculation = async () => {
    if (!result || !config?.template?.id || isSaving) return;
    
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      // Save to database via API
      const response = await fetch('/api/calculator/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: config.template.id,
          clientConfigId: config.clientConfig?.id,
          input,
          result
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save calculation');
      }

      // Call parent callback if provided
      if (onSaveCalculation) {
        onSaveCalculation(input, result);
      }

      // Reload history from database to show the new calculation
      await reloadHistory();

      // Show success feedback
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Hide after 3 seconds

    } catch (error) {
      console.error('Failed to save calculation:', error);
      // You could add proper error handling here
    } finally {
      setIsSaving(false);
    }
  };

  const clearForm = () => {
    setInput({
      headcount: 0,
      foodCost: 0,
      mileage: 0,
      requiresBridge: false,
      numberOfStops: 1,
      tips: 0,
      adjustments: 0,
      mileageRate: 0.70,
      deliveryArea: ''
    });
  };

  // Memoized Ready Set earnings breakdown
  const readySetEarnings = useMemo(() => {
    if (!result || !result.metadata) return null;

    const readySetFee = result.metadata.readySetFee || 0;
    const mileageRate = result.metadata.readySetMileageRate || result.metadata.vendorMileageRate || 3.0;
    const mileage = result.metadata.mileage || 0;
    const bridgeToll = result.driverPayments?.bridgeToll || 0;
    const distanceThreshold = 10;
    const extraMiles = Math.max(0, mileage - distanceThreshold);
    const readySetMileageFee = extraMiles * mileageRate;
    const totalReadySetFee = readySetFee + readySetMileageFee + bridgeToll;

    const breakdown = [
      { label: 'Base Fee', amount: readySetFee },
      { label: `Add-on Fee (${extraMiles.toFixed(1)} mi × $${mileageRate})`, amount: readySetMileageFee }
    ];

    if (bridgeToll > 0) {
      breakdown.push({ label: 'Bridge Toll', amount: bridgeToll });
    }

    return {
      baseFee: readySetFee,
      addonFee: readySetMileageFee,
      mileageFee: readySetMileageFee,
      bridgeToll,
      mileage,
      mileageRate,
      totalFee: totalReadySetFee,
      breakdown
    };
  }, [result]);

  if (isLoading || isLoadingTemplates) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading calculator configuration...</span>
      </div>
    );
  }

  const error = configError || calculationError;

  return (
    <div className={`w-full max-w-5xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="space-y-2">
            <h1 className="text-xl font-bold flex items-center gap-3 text-slate-900">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-md">
                <Calculator className="h-4 w-4 text-white" />
              </div>
              Delivery Calculator
            </h1>
            <p className="text-slate-600 text-sm leading-relaxed">
              Configure and calculate delivery pricing with flexible rules
            </p>
          </div>
          {result && (
            <Button 
              onClick={handleSaveCalculation} 
              variant={saveSuccess ? "default" : "outline"}
              disabled={isSaving}
              className={`h-10 px-6 font-medium transition-all duration-200 flex items-center gap-2 ${
                saveSuccess 
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg" 
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Calculation
                </>
              )}
            </Button>
          )}
        </div>

        {/* Configuration Selection */}
        <Card className="border-0 shadow-md rounded-2xl bg-white/90 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="template-select" className="text-slate-700 font-semibold text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Calculator Template
                </Label>
                <Select
                  value={config?.template?.id || templateId || ''}
                  onValueChange={handleTemplateChange}
                >
                  <SelectTrigger className="h-10 border-slate-200 focus:border-blue-400 focus:ring-blue-200 bg-white shadow-sm transition-all duration-200 hover:border-slate-300">
                    <SelectValue placeholder="Select a calculator template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="client-config-select" className="text-slate-700 font-semibold text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Client Configuration <span className="text-slate-500 font-normal">(Optional)</span>
                </Label>
                <Select
                  value={selectedClientConfigId || config?.clientConfig?.id || ''}
                  onValueChange={handleClientConfigChange}
                >
                  <SelectTrigger className="h-10 border-slate-200 focus:border-purple-400 focus:ring-purple-200 bg-white shadow-sm transition-all duration-200 hover:border-slate-300">
                    <SelectValue placeholder="No customization (use template defaults)" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientConfigs.map(clientConfig => (
                      <SelectItem key={clientConfig.id} value={clientConfig.id}>
                        {clientConfig.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Alert className="mb-4 border-red-200 bg-gradient-to-r from-red-50 to-rose-50 shadow-sm rounded-xl">
          <div className="p-1.5 bg-red-100 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <AlertDescription className="text-red-800 leading-relaxed">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => { clearError(); clearCalculationError(); }}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <Card className="border-0 shadow-lg rounded-2xl bg-white/95 backdrop-blur-sm mb-6">
          <CardContent className="p-2">
            <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-slate-50 to-slate-100 p-1.5 rounded-xl shadow-inner h-12">
              <TabsTrigger 
                value="input" 
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-900 text-slate-600 font-semibold transition-all duration-200 hover:text-slate-800 whitespace-nowrap min-h-[2.5rem]"
              >
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>Input</span>
              </TabsTrigger>
              <TabsTrigger 
                value="results" 
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-900 text-slate-600 font-semibold transition-all duration-200 hover:text-slate-800 whitespace-nowrap min-h-[2.5rem]"
              >
                <DollarSign className="h-4 w-4 flex-shrink-0" />
                <span>Results</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-900 text-slate-600 font-semibold transition-all duration-200 hover:text-slate-800 whitespace-nowrap min-h-[2.5rem]"
              >
                <History className="h-4 w-4 flex-shrink-0" />
                <span>History</span>
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>

        {/* Input Tab */}
        <TabsContent value="input" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card className="border-0 shadow-lg rounded-2xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headcount" className="text-slate-700 font-medium text-sm">
                    Headcount
                  </Label>
                  <Input
                    id="headcount"
                    type="number"
                    min="0"
                    value={input.headcount}
                    onChange={(e) => handleInputChange('headcount', parseInt(e.target.value) || 0)}
                    placeholder="Number of people"
                    className="h-9 border-slate-200 focus:border-slate-400 focus:ring-slate-200 bg-white/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="foodCost" className="text-slate-700 font-medium text-sm">
                    Food Cost ($)
                  </Label>
                  <Input
                    id="foodCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={input.foodCost}
                    onChange={(e) => handleInputChange('foodCost', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="h-9 border-slate-200 focus:border-slate-400 focus:ring-slate-200 bg-white/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deliveryArea" className="text-slate-700 font-medium text-sm">
                    Delivery Area
                  </Label>
                  <Input
                    id="deliveryArea"
                    type="text"
                    value={input.deliveryArea}
                    onChange={(e) => handleInputChange('deliveryArea', e.target.value)}
                    placeholder="e.g., Downtown, Suburbs"
                    className="h-9 border-slate-200 focus:border-slate-400 focus:ring-slate-200 bg-white/80"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Distance & Location */}
            <Card className="border-0 shadow-lg rounded-2xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-sm">
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  Distance & Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mileage" className="text-slate-700 font-medium text-sm">
                    Total Mileage
                  </Label>
                  <Input
                    id="mileage"
                    type="number"
                    min="0"
                    step="0.1"
                    value={input.mileage}
                    onChange={(e) => handleInputChange('mileage', parseFloat(e.target.value) || 0)}
                    placeholder="Round trip distance"
                    className="h-9 border-slate-200 focus:border-slate-400 focus:ring-slate-200 bg-white/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mileageRate" className="text-slate-700 font-medium text-sm">
                    Mileage Rate ($/mile)
                  </Label>
                  <Input
                    id="mileageRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={input.mileageRate}
                    onChange={(e) => handleInputChange('mileageRate', parseFloat(e.target.value) || 0.35)}
                    placeholder="0.35"
                    className="h-9 border-slate-200 focus:border-slate-400 focus:ring-slate-200 bg-white/80"
                  />
                </div>

                <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-slate-50 to-white rounded-lg border border-slate-200">
                  <Switch
                    id="bridge"
                    checked={input.requiresBridge}
                    onCheckedChange={(checked) => handleInputChange('requiresBridge', checked)}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <Label htmlFor="bridge" className="text-slate-700 font-medium cursor-pointer text-sm">
                    Requires Bridge Crossing
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Additional Services */}
            <Card className="border-0 shadow-lg rounded-2xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <div className="p-1.5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg shadow-sm">
                    <Truck className="h-4 w-4 text-white" />
                  </div>
                  Additional Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stops" className="text-slate-700 font-medium text-sm">
                    Number of Stops
                  </Label>
                  <Input
                    id="stops"
                    type="number"
                    min="1"
                    value={input.numberOfStops}
                    onChange={(e) => handleInputChange('numberOfStops', parseInt(e.target.value) || 1)}
                    className="h-9 border-slate-200 focus:border-slate-400 focus:ring-slate-200 bg-white/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tips" className="text-slate-700 font-medium text-sm">
                    Driver Bonus Pay ($)
                  </Label>
                  <Input
                    id="tips"
                    type="number"
                    min="0"
                    step="0.01"
                    value={input.tips}
                    onChange={(e) => handleInputChange('tips', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="h-9 border-slate-200 focus:border-slate-400 focus:ring-slate-200 bg-white/80"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Additional bonus pay for driver (e.g., $10)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adjustments" className="text-slate-700 font-medium text-sm">
                    Adjustments ($)
                  </Label>
                  <Input
                    id="adjustments"
                    type="number"
                    step="0.01"
                    value={input.adjustments}
                    onChange={(e) => handleInputChange('adjustments', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="h-9 border-slate-200 focus:border-slate-400 focus:ring-slate-200 bg-white/80"
                  />
                  <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                    Positive for bonuses, negative for deductions
                  </p>
                </div>

              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="border-0 shadow-lg rounded-2xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                  <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg shadow-sm">
                    <Settings className="h-4 w-4 text-white" />
                  </div>
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={clearForm} 
                  variant="outline" 
                  className="w-full h-9 font-medium border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
                >
                  Clear Form
                </Button>
                
                {result && (
                  <Button 
                    onClick={() => setActiveTab('results')} 
                    className="w-full h-9 font-medium bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg transition-all duration-200"
                  >
                    View Results
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6 mt-0">
          {isCalculating && (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
                <span className="text-base font-medium text-slate-700">Calculating...</span>
              </div>
            </div>
          )}

          {result && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ready Set Earnings */}
              {readySetEarnings && (
                <Card className="border-0 shadow-lg rounded-2xl bg-white/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                      <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-sm">
                        <DollarSign className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-emerald-700">Ready Set Earnings</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {readySetEarnings.breakdown.map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-2">
                          <span className="text-slate-600 font-medium">{item.label}:</span>
                          <span className="font-semibold text-slate-900">${formatCurrency(item.amount)}</span>
                        </div>
                      ))}

                      <Separator className="my-4" />
                      <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200">
                        <span className="text-lg font-bold text-emerald-800">Total Ready Set Fee:</span>
                        <span className="text-2xl font-bold text-emerald-900">${formatCurrency(readySetEarnings.totalFee)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Driver Payments */}
              <Card className="border-0 shadow-lg rounded-2xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                      <Truck className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-blue-700">Driver Payments</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(result.driverPayments.basePay ?? 0) > 0 && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-600 font-medium">Base Pay:</span>
                        <span className="font-semibold text-slate-900">${formatCurrency(result.driverPayments.basePay)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-600 font-medium">Mileage ({input.mileage} × ${input.mileageRate}):</span>
                      <span className="font-semibold text-slate-900">${formatCurrency(result.driverPayments.mileagePay)}</span>
                    </div>

                    {(result.driverPayments.bonus ?? 0) > 0 && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-600 font-medium">Driver Bonus Pay:</span>
                        <span className="font-semibold text-emerald-600">${formatCurrency(result.driverPayments.bonus)}</span>
                      </div>
                    )}

                    {(result.driverPayments.bridgeToll ?? 0) > 0 && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-600 font-medium">Bridge Toll:</span>
                        <span className="font-semibold text-slate-900">${formatCurrency(result.driverPayments.bridgeToll)}</span>
                      </div>
                    )}

                    {(result.driverPayments.extraStopsBonus ?? 0) > 0 && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-600 font-medium">Extra Stops Bonus:</span>
                        <span className="font-semibold text-slate-900">${formatCurrency(result.driverPayments.extraStopsBonus)}</span>
                      </div>
                    )}


                    {(result.driverPayments.adjustments ?? 0) !== 0 && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-600 font-medium">Adjustments:</span>
                        <span className={`font-semibold ${(result.driverPayments.adjustments ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          ${formatCurrency(result.driverPayments.adjustments)}
                        </span>
                      </div>
                    )}

                    {/* Custom payments */}
                    {result.driverPayments.customPayments && typeof result.driverPayments.customPayments === 'object' &&
                     Object.entries(result.driverPayments.customPayments).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-2">
                        <span className="text-slate-600 font-medium">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                        <span className="font-semibold text-slate-900">${formatCurrency(value)}</span>
                      </div>
                    ))}

                    <Separator className="my-4" />
                    <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                      <span className="text-lg font-bold text-blue-800">Total:</span>
                      <span className="text-2xl font-bold text-blue-900">${formatCurrency(result.driverPayments.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!result && !isCalculating && (
            <Card className="border-0 shadow-lg rounded-3xl bg-white/80 backdrop-blur-sm">
              <CardContent className="flex items-center justify-center p-16">
                <div className="text-center text-slate-500">
                  <div className="p-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                    <Calculator className="h-12 w-12 text-slate-400" />
                  </div>
                  <p className="text-xl font-medium text-slate-600 mb-2">Ready to Calculate</p>
                  <p className="text-slate-500">Enter delivery information in the Input tab to see calculation results</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6 mt-0">
          <Card className="border-0 shadow-lg rounded-2xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl font-semibold text-slate-800">
                <div className="p-1.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg shadow-sm">
                  <History className="h-4 w-4 text-white" />
                </div>
                Recent Calculations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="text-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-500">Loading calculation history...</p>
                </div>
              ) : historyError ? (
                <div className="text-center text-red-500 py-16">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-4" />
                  <p className="text-red-600 mb-2">Failed to load calculation history</p>
                  <p className="text-slate-500 text-sm">{historyError}</p>
                </div>
              ) : savedResults.length > 0 ? (
                <div className="space-y-4">
                  {savedResults.map((savedResult, index) => {
                    const customerTotal = Number(savedResult.customer_total) || 0;
                    const driverTotal = Number(savedResult.driver_total) || 0;
                    const profit = customerTotal - driverTotal;
                    return (
                      <div key={savedResult.id || index} className="border border-slate-200 rounded-2xl p-6 bg-gradient-to-r from-white to-slate-50 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="flex justify-between items-center">
                          <div className="flex gap-6">
                            <span className="font-semibold text-slate-900">
                              Customer: <span className="text-emerald-600">${formatCurrency(customerTotal)}</span>
                            </span>
                            <span className="font-semibold text-slate-900">
                              Driver: <span className="text-blue-600">${formatCurrency(driverTotal)}</span>
                            </span>
                            <span className={`font-semibold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              Profit: ${formatCurrency(profit)}
                            </span>
                          </div>
                          <span className="text-sm text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                            {new Date(savedResult.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-slate-500 py-16">
                  <div className="p-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                    <History className="h-12 w-12 text-slate-400" />
                  </div>
                  <p className="text-xl font-medium text-slate-600 mb-2">No saved calculations yet</p>
                  <p className="text-slate-500">Calculations will appear here when you save them</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
