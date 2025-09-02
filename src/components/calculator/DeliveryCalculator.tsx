// DeliveryCalculator - Main calculator component with flexible pricing system
// Provides comprehensive delivery cost calculation with real-time updates

'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Calculator, DollarSign, Truck, Users, MapPin } from 'lucide-react';
import { useCalculatorConfig, useCalculator } from '@/hooks/useCalculatorConfig';
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
    autoLoad: true 
  });

  // Hook for real-time calculation
  const { 
    result, 
    isCalculating, 
    error: calculationError,
    calculate,
    clearError: clearCalculationError
  } = useCalculator(config);

  // Form state
  const [input, setInput] = useState<CalculationInput>({
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

  // UI state
  const [activeTab, setActiveTab] = useState('input');
  const [savedResults, setSavedResults] = useState<CalculationResult[]>([]);

  // Auto-calculate when input changes and config is loaded
  useEffect(() => {
    console.log('🔍 Calculator Debug:', {
      hasConfig: !!config,
      configTemplate: config?.template?.name,
      configId: config?.template?.id,
      inputValues: input,
      hasNonZeroInput: Object.values(input).some(val => val !== 0 && val !== ''),
      willCalculate: config && Object.values(input).some(val => val !== 0 && val !== '')
    });

    if (config && Object.values(input).some(val => val !== 0 && val !== '')) {
      console.log('⏰ Starting calculation with 300ms delay...');
      const timer = setTimeout(() => {
        console.log('🧮 Triggering calculation...');
        calculate(input);
      }, 300); // Debounce calculations

      return () => clearTimeout(timer);
    }
  }, [input, config, calculate]);

  // Call completion callback when calculation finishes
  useEffect(() => {
    if (result && onCalculationComplete) {
      onCalculationComplete(result);
    }
  }, [result, onCalculationComplete]);

  // Load client configs when templates change
  useEffect(() => {
    if (templates.length > 0) {
      loadClientConfigs();
    }
  }, [templates, loadClientConfigs]);

  const handleInputChange = (field: keyof CalculationInput, value: any) => {
    setInput(prev => ({ ...prev, [field]: value }));
  };

  const handleTemplateChange = (newTemplateId: string) => {
    setActiveTemplate(newTemplateId);
    clearCalculationError();
  };

  const handleClientConfigChange = (configId: string | undefined) => {
    setActiveClientConfig(configId);
    clearCalculationError();
  };

  const handleSaveCalculation = () => {
    if (result && onSaveCalculation) {
      onSaveCalculation(input, result);
      setSavedResults(prev => [result, ...prev.slice(0, 4)]); // Keep last 5
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

  // Memoized profit analysis
  const profitAnalysis = useMemo(() => {
    if (!result) return null;

    const { profit, profitMargin } = result;
    const isHealthy = profitMargin >= 20;
    const isWarning = profitMargin >= 10 && profitMargin < 20;
    const isDangerous = profitMargin < 10;

    return {
      profit,
      profitMargin,
      status: isHealthy ? 'healthy' : isWarning ? 'warning' : 'danger',
      color: isHealthy ? 'text-green-600' : isWarning ? 'text-yellow-600' : 'text-red-600',
      bgColor: isHealthy ? 'bg-green-50' : isWarning ? 'bg-yellow-50' : 'bg-red-50'
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
    <div className={`w-full max-w-7xl mx-auto ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              Delivery Calculator
            </h1>
            <p className="text-gray-600 mt-1">
              Configure and calculate delivery pricing with flexible rules
            </p>
          </div>
          {result && (
            <Button onClick={handleSaveCalculation} variant="outline">
              Save Calculation
            </Button>
          )}
        </div>

        {/* Configuration Selection */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="template-select">Calculator Template</Label>
            <Select 
              value={config?.template?.id || ''} 
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger>
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

          <div>
            <Label htmlFor="client-config-select">Client Configuration (Optional)</Label>
            <Select 
              value={config?.clientConfig?.id || 'default'} 
              onValueChange={(value) => handleClientConfigChange(value === 'default' ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client configuration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Configuration</SelectItem>
                {clientConfigs.map(clientConfig => (
                  <SelectItem key={clientConfig.id} value={clientConfig.id}>
                    {clientConfig.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {error}
            <Button 
              variant="link" 
              size="sm" 
              onClick={() => { clearError(); clearCalculationError(); }}
              className="ml-2 text-red-600"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="input" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Input
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Input Tab */}
        <TabsContent value="input" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headcount">Headcount</Label>
                  <Input
                    id="headcount"
                    type="number"
                    min="0"
                    value={input.headcount}
                    onChange={(e) => handleInputChange('headcount', parseInt(e.target.value) || 0)}
                    placeholder="Number of people"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="foodCost">Food Cost ($)</Label>
                  <Input
                    id="foodCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={input.foodCost}
                    onChange={(e) => handleInputChange('foodCost', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deliveryArea">Delivery Area</Label>
                  <Input
                    id="deliveryArea"
                    type="text"
                    value={input.deliveryArea}
                    onChange={(e) => handleInputChange('deliveryArea', e.target.value)}
                    placeholder="e.g., Downtown, Suburbs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Distance & Location */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Distance & Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mileage">Total Mileage</Label>
                  <Input
                    id="mileage"
                    type="number"
                    min="0"
                    step="0.1"
                    value={input.mileage}
                    onChange={(e) => handleInputChange('mileage', parseFloat(e.target.value) || 0)}
                    placeholder="Round trip distance"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mileageRate">Mileage Rate ($/mile)</Label>
                  <Input
                    id="mileageRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={input.mileageRate}
                    onChange={(e) => handleInputChange('mileageRate', parseFloat(e.target.value) || 0.70)}
                    placeholder="0.70"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="bridge"
                    checked={input.requiresBridge}
                    onCheckedChange={(checked) => handleInputChange('requiresBridge', checked)}
                  />
                  <Label htmlFor="bridge">Requires Bridge Crossing</Label>
                </div>
              </CardContent>
            </Card>

            {/* Additional Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Additional Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stops">Number of Stops</Label>
                  <Input
                    id="stops"
                    type="number"
                    min="1"
                    value={input.numberOfStops}
                    onChange={(e) => handleInputChange('numberOfStops', parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tips">Tips ($)</Label>
                  <Input
                    id="tips"
                    type="number"
                    min="0"
                    step="0.01"
                    value={input.tips}
                    onChange={(e) => handleInputChange('tips', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adjustments">Adjustments ($)</Label>
                  <Input
                    id="adjustments"
                    type="number"
                    step="0.01"
                    value={input.adjustments}
                    onChange={(e) => handleInputChange('adjustments', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                  <p className="text-sm text-gray-500">
                    Positive for bonuses, negative for deductions
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={clearForm} 
                  variant="outline" 
                  className="w-full"
                >
                  Clear Form
                </Button>
                
                {result && (
                  <Button 
                    onClick={() => setActiveTab('results')} 
                    className="w-full"
                  >
                    View Results
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          {isCalculating && (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Calculating...</span>
            </div>
          )}

          {result && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Charges */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-700">Customer Charges</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {result.customerCharges.baseFee > 0 && (
                      <div className="flex justify-between">
                        <span>Base Fee:</span>
                        <span>${result.customerCharges.baseFee.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {result.customerCharges.longDistanceCharge > 0 && (
                      <div className="flex justify-between">
                        <span>Long Distance:</span>
                        <span>${result.customerCharges.longDistanceCharge.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {result.customerCharges.bridgeToll > 0 && (
                      <div className="flex justify-between">
                        <span>Bridge Toll:</span>
                        <span>${result.customerCharges.bridgeToll.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {result.customerCharges.extraStopsCharge > 0 && (
                      <div className="flex justify-between">
                        <span>Extra Stops:</span>
                        <span>${result.customerCharges.extraStopsCharge.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {result.customerCharges.headcountCharge > 0 && (
                      <div className="flex justify-between">
                        <span>Headcount Charge:</span>
                        <span>${result.customerCharges.headcountCharge.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {result.customerCharges.foodCost > 0 && (
                      <div className="flex justify-between">
                        <span>Food Cost:</span>
                        <span>${result.customerCharges.foodCost.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Custom charges */}
                    {Object.entries(result.customerCharges.customCharges).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                        <span>${value.toFixed(2)}</span>
                      </div>
                    ))}
                    
                    <Separator />
                    <div className="flex justify-between font-semibold text-base">
                      <span>Total:</span>
                      <span>${result.customerCharges.total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Driver Payments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-700">Driver Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {result.driverPayments.basePay > 0 && (
                      <div className="flex justify-between">
                        <span>Base Pay:</span>
                        <span>${result.driverPayments.basePay.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span>Mileage ({input.mileage} × ${input.mileageRate}):</span>
                      <span>${result.driverPayments.mileagePay.toFixed(2)}</span>
                    </div>
                    
                    {result.driverPayments.bridgeToll > 0 && (
                      <div className="flex justify-between">
                        <span>Bridge Toll:</span>
                        <span>${result.driverPayments.bridgeToll.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {result.driverPayments.extraStopsBonus > 0 && (
                      <div className="flex justify-between">
                        <span>Extra Stops Bonus:</span>
                        <span>${result.driverPayments.extraStopsBonus.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {result.driverPayments.tips > 0 && (
                      <div className="flex justify-between">
                        <span>Tips:</span>
                        <span>${result.driverPayments.tips.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {result.driverPayments.adjustments !== 0 && (
                      <div className="flex justify-between">
                        <span>Adjustments:</span>
                        <span className={result.driverPayments.adjustments >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${result.driverPayments.adjustments.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Custom payments */}
                    {Object.entries(result.driverPayments.customPayments).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                        <span>${value.toFixed(2)}</span>
                      </div>
                    ))}
                    
                    <Separator />
                    <div className="flex justify-between font-semibold text-base">
                      <span>Total:</span>
                      <span>${result.driverPayments.total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profit Analysis */}
              {profitAnalysis && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Profit Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`p-4 rounded-lg ${profitAnalysis.bgColor}`}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            ${profitAnalysis.profit.toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-600">Gross Profit</div>
                        </div>
                        
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${profitAnalysis.color}`}>
                            {profitAnalysis.profitMargin.toFixed(1)}%
                          </div>
                          <div className="text-sm text-gray-600">Profit Margin</div>
                        </div>
                        
                        <div className="text-center">
                          <Badge 
                            variant={profitAnalysis.status === 'healthy' ? 'default' : 
                                    profitAnalysis.status === 'warning' ? 'secondary' : 'destructive'}
                          >
                            {profitAnalysis.status === 'healthy' ? 'Healthy' : 
                             profitAnalysis.status === 'warning' ? 'Fair' : 'Poor'}
                          </Badge>
                          <div className="text-sm text-gray-600 mt-1">Status</div>
                        </div>
                      </div>
                      
                      <div className="mt-4 text-sm text-gray-700">
                        {profitAnalysis.status === 'healthy' && 'Excellent profit margin! This delivery is very profitable.'}
                        {profitAnalysis.status === 'warning' && 'Decent profit margin, but consider optimizing costs.'}
                        {profitAnalysis.status === 'danger' && 'Low profit margin. Review pricing or reduce costs.'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {!result && !isCalculating && (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="text-center text-gray-500">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Enter delivery information to see calculation results</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Calculations</CardTitle>
            </CardHeader>
            <CardContent>
              {savedResults.length > 0 ? (
                <div className="space-y-4">
                  {savedResults.map((savedResult, index) => (
                    <div key={index} className="border rounded p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex gap-4">
                          <span className="font-medium">
                            Customer: ${savedResult.customerCharges.total.toFixed(2)}
                          </span>
                          <span className="font-medium">
                            Driver: ${savedResult.driverPayments.total.toFixed(2)}
                          </span>
                          <span className={`font-medium ${savedResult.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Profit: ${savedResult.profit.toFixed(2)}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {savedResult.calculatedAt.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p>No saved calculations yet</p>
                  <p className="text-sm">Calculations will appear here when you save them</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
