// Delivery Calculator System - Admin Interface
// Flexible calculator system for all delivery types

'use client';

import { useState, useEffect } from 'react';
import { DeliveryCalculator } from '@/components/calculator/DeliveryCalculator';
import { useCalculatorConfig } from '@/hooks/useCalculatorConfig';
import { CalculationResult, CalculationInput } from '@/types/calculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, History, Info, CheckCircle, AlertTriangle } from 'lucide-react';

export default function CalculatorPage() {
  const [savedCalculations, setSavedCalculations] = useState<Array<{
    input: CalculationInput;
    result: CalculationResult;
    timestamp: Date;
  }>>([]);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [migrationStatus, setMigrationStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  // Load available templates
  const { 
    templates, 
    isLoadingTemplates, 
    error: templatesError 
  } = useCalculatorConfig({ autoLoad: true });

  // Set default template when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      // Find Ready Set Food template first, then Standard Delivery, or use first one
      const readySetTemplate = templates.find(t => t.name === 'Ready Set Food Standard Delivery');
      const standardTemplate = templates.find(t => t.name === 'Standard Delivery');
      const defaultTemplate = readySetTemplate || standardTemplate || templates[0];
      
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
        console.log('🎯 Selected template:', defaultTemplate.name, 'ID:', defaultTemplate.id);
        console.log('📋 Available templates:', templates.map(t => t.name).join(', '));
      }
    }
  }, [templates, selectedTemplateId]);

  // Check migration status (simplified for demo)
  useEffect(() => {
    if (templates.length > 0) {
      setMigrationStatus('ready');
    } else if (templatesError) {
      setMigrationStatus('error');
    }
  }, [templates, templatesError]);

  const handleCalculationComplete = (result: CalculationResult) => {
    // Auto-save calculations for demo purposes
    console.log('Calculation completed:', result);
  };

  const handleSaveCalculation = (input: CalculationInput, result: CalculationResult) => {
    setSavedCalculations(prev => [
      { input, result, timestamp: new Date() },
      ...prev.slice(0, 9) // Keep last 10
    ]);
  };

  if (isLoadingTemplates) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-4"></div>
          <span>Loading calculator system...</span>
        </div>
      </div>
    );
  }

  if (migrationStatus === 'error' || templatesError) {
    return (
      <div className="container mx-auto py-8">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            <strong>Calculator System Not Ready</strong>
            <br />
            The new calculator system needs to be set up. Please run the migration:
            <br />
            <code className="mt-2 block bg-gray-800 text-white p-2 rounded">
              pnpm calculator:setup
            </code>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calculator className="h-8 w-8" />
            Delivery Calculator
          </h1>
          <p className="text-gray-600 mt-2">
            Flexible calculator system for all delivery types and pricing models
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="default" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            System Ready
          </Badge>
          <Badge variant="secondary">{templates.length} Templates</Badge>
        </div>
      </div>

      {/* Status Banner */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-blue-800">
          <strong>Flexible Calculator System Active!</strong> Configurable pricing rules for all delivery types.
          <br />
          <strong>Available templates:</strong> {templates.map(t => t.name).join(', ')}
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="calculator" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Calculator
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Recent Calculations
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Main Calculator Tab */}
        <TabsContent value="calculator">
          <div className="space-y-6">
            {selectedTemplateId && (
              <DeliveryCalculator
                templateId={selectedTemplateId}
                onCalculationComplete={handleCalculationComplete}
                onSaveCalculation={handleSaveCalculation}
                className="w-full"
              />
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Recent Calculations</CardTitle>
            </CardHeader>
            <CardContent>
              {savedCalculations.length > 0 ? (
                <div className="space-y-4">
                  {savedCalculations.map((calc, index) => (
                    <div key={index} className="border rounded p-4 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                          <div>
                            <div className="text-sm text-gray-600">Customer Total</div>
                            <div className="font-semibold">${calc.result.customerCharges.total.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Driver Total</div>
                            <div className="font-semibold">${calc.result.driverPayments.total.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Profit</div>
                            <div className={`font-semibold ${calc.result.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${calc.result.profit.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Margin</div>
                            <div className="font-semibold">{calc.result.profitMargin.toFixed(1)}%</div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500 ml-4">
                          {calc.timestamp.toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-500">
                        Mileage: {calc.input.mileage} mi | Headcount: {calc.input.headcount} | 
                        Stops: {calc.input.numberOfStops} | Bridge: {calc.input.requiresBridge ? 'Yes' : 'No'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No calculations yet</p>
                  <p className="text-sm">Switch to the Calculator tab to perform calculations</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => (
              <Card key={template.id} className={selectedTemplateId === template.id ? 'ring-2 ring-blue-500' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {template.name}
                    {selectedTemplateId === template.id && (
                      <Badge variant="default">Active</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    {template.description}
                  </p>
                  
                  <div className="space-y-2">
                    <div className="text-sm">
                      <strong>Rules:</strong> {template.pricingRules?.length || 0}
                    </div>
                    <div className="text-sm">
                      <strong>Status:</strong> {template.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  
                  <Button
                    variant={selectedTemplateId === template.id ? "default" : "outline"}
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    {selectedTemplateId === template.id ? 'Currently Active' : 'Use This Template'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Calculator Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Flexible Pricing Rules</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Configurable base fees and rates</li>
                    <li>• Distance-based pricing with thresholds</li>
                    <li>• Bridge tolls and extra stop charges</li>
                    <li>• Headcount-based adjustments</li>
                    <li>• Custom rule evaluation</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Advanced Features</h4>
                  <ul className="text-sm space-y-1">
                    <li>• Client-specific configurations</li>
                    <li>• Real-time profit analysis</li>
                    <li>• Historical calculation tracking</li>
                    <li>• Multiple delivery templates</li>
                    <li>• API integration ready</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
