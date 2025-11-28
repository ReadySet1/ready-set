// Delivery Calculator System - Admin Interface (Updated to use Ready Set Food template)
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
import { Calculator, History, Info, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';

interface CalculatorClientProps {
  userType: string;
}

export default function CalculatorClient({ userType }: CalculatorClientProps) {
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

  // Set default template when templates load (prioritize Ready Set Food template)
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      // Find Ready Set Food template first, then Standard Delivery, or use first one
      const readySetTemplate = templates.find(t =>
        t.name === 'Ready Set Food Standard Delivery'
      );
      const standardTemplate = templates.find(t =>
        t.name === 'Standard Delivery'
      );
      const defaultTemplate = readySetTemplate || standardTemplate || templates[0];

      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
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
  }, [templates.length, templatesError]);

  const handleCalculationComplete = (result: CalculationResult) => {
    // Auto-save calculations for demo purposes
  };

  const handleSaveCalculation = (input: CalculationInput, result: CalculationResult) => {
    setSavedCalculations(prev => [
      { input, result, timestamp: new Date() },
      ...prev.slice(0, 9) // Keep last 10
    ]);
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

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
            {templatesError || 'The calculator system needs to be set up.'}
            <br />
            <strong>Templates found:</strong> {templates.length}
            {templates.length === 0 && (
              <>
                <br />
                Please ensure the Ready Set Food template migration has been applied:
                <br />
                <code className="mt-2 block bg-gray-800 text-white p-2 rounded">
                  pnpm tsx scripts/final-ready-set-setup.sql
                </code>
              </>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="container mx-auto py-6 px-4 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-900">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              Delivery Calculator
            </h1>
            <p className="text-slate-600 text-base max-w-2xl leading-relaxed">
              Flexible calculator system for all delivery types and pricing models
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="default" className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 border-green-200 shadow-sm">
              <CheckCircle className="h-4 w-4" />
              System Ready
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 bg-blue-100 text-blue-700 border-blue-200 shadow-sm">
              {templates.length} Templates
            </Badge>
            
            <Link href="/admin/calculator/settings">
              <Button variant="outline" className="flex items-center gap-2 h-9 px-4 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 shadow-sm">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="calculator" className="w-full">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-2 mb-8">
            <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-slate-50 to-slate-100 p-1.5 rounded-xl shadow-inner h-14">
              <TabsTrigger 
                value="calculator" 
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-900 text-slate-600 font-semibold transition-all duration-200 hover:text-slate-800 whitespace-nowrap"
              >
                <Calculator className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Calculator</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-900 text-slate-600 font-semibold transition-all duration-200 hover:text-slate-800 whitespace-nowrap"
              >
                <History className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Recent Calculations</span>
                <span className="sm:hidden">Recent</span>
              </TabsTrigger>
              <TabsTrigger 
                value="templates" 
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-900 text-slate-600 font-semibold transition-all duration-200 hover:text-slate-800 whitespace-nowrap"
              >
                <Info className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Templates</span>
              </TabsTrigger>
            </TabsList>
          </div>

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
            <Card className="border-0 shadow-lg rounded-3xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-semibold text-slate-800 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-sm">
                    <History className="h-5 w-5 text-white" />
                  </div>
                  Recent Calculations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {savedCalculations.length > 0 ? (
                  <div className="space-y-4">
                    {savedCalculations.map((calc, index) => (
                      <div key={index} className="border border-slate-200 rounded-2xl p-6 bg-gradient-to-r from-white to-slate-50 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1">
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-slate-500">Customer Total</div>
                              <div className="text-xl font-bold text-slate-900">${calc.result.customerCharges.total.toFixed(2)}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-slate-500">Driver Total</div>
                              <div className="text-xl font-bold text-slate-900">${calc.result.driverPayments.total.toFixed(2)}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-slate-500">Profit</div>
                              <div className={`text-xl font-bold ${calc.result.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                ${calc.result.profit.toFixed(2)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-slate-500">Margin</div>
                              <div className="text-xl font-bold text-slate-900">{calc.result.profitMargin?.toFixed(1) || '0.0'}%</div>
                            </div>
                          </div>
                          <div className="text-sm text-slate-400 ml-6 bg-slate-100 px-3 py-1 rounded-full">
                            {calc.timestamp.toLocaleString()}
                          </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                              <strong>Mileage:</strong> {calc.input.mileage} mi
                            </span>
                            <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
                              <strong>Headcount:</strong> {calc.input.headcount}
                            </span>
                            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                              <strong>Stops:</strong> {calc.input.numberOfStops}
                            </span>
                            <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full">
                              <strong>Bridge:</strong> {calc.input.requiresBridge === true ? 'Yes' : 'No'}
                            </span>
                            {calc.input.tips && calc.input.tips > 0 && (
                              <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full">
                                <strong>Tips:</strong> ${calc.input.tips}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-16">
                    <div className="p-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                      <Calculator className="h-12 w-12 text-slate-400" />
                    </div>
                    <p className="text-xl font-medium text-slate-600 mb-2">No calculations yet</p>
                    <p className="text-slate-500">Switch to the Calculator tab to perform calculations</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
            {/* Note: Keeping old template system for backward compatibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {templates.map(template => (
                <Card
                  key={template.id}
                  className={`border-0 shadow-lg rounded-3xl bg-white/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:scale-105 ${
                    selectedTemplateId === template.id
                      ? 'ring-2 ring-blue-500 ring-offset-4 shadow-xl'
                      : ''
                  }`}
                >
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="text-slate-800 font-semibold">{template.name}</span>
                      <div className="flex gap-2">
                        {selectedTemplateId === template.id && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 shadow-sm">
                            Active
                          </Badge>
                        )}
                        {template.name === 'Ready Set Food Standard Delivery' && (
                          <Badge className="bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border-emerald-200 shadow-sm">
                            Ready Set
                          </Badge>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-slate-600 leading-relaxed">
                      {template.description}
                    </p>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-500">Rules:</span>
                        <span className="text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-full">
                          {template.pricingRules?.length || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-500">Status:</span>
                        <span className={`text-sm font-semibold px-2 py-1 rounded-full ${
                          template.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {template.name === 'Ready Set Food Standard Delivery' && (
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-3 rounded-xl border border-emerald-200">
                          <div className="text-sm text-emerald-700">
                            <strong>Features:</strong> Tiered compensation, $0.35 mileage rate
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      variant={selectedTemplateId === template.id ? "default" : "outline"}
                      size="lg"
                      className={`w-full mt-6 h-12 font-medium transition-all duration-200 ${
                        selectedTemplateId === template.id
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      {selectedTemplateId === template.id ? 'Currently Active' : 'Use This Template'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card className="mt-8 border-0 shadow-lg rounded-3xl bg-gradient-to-br from-white to-slate-50">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-semibold text-slate-800 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl shadow-sm">
                    <Info className="h-5 w-5 text-white" />
                  </div>
                  Calculator Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
                    <h4 className="font-bold text-lg mb-4 text-emerald-700 flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      Ready Set Food Features
                    </h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Tiered base fees: $65, $75, $85, $95, $105</span>
                      </li>
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Tiered driver pay: $35, $40, $50, $60, $70</span>
                      </li>
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Mileage: $0.35/mile for drivers (&gt;10 miles)</span>
                      </li>
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Long distance: $3/mile for customers (&gt;10 miles)</span>
                      </li>
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Bridge tolls: $8 each way</span>
                      </li>
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Tip pass-through (excludes bonus structure)</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
                    <h4 className="font-bold text-lg mb-4 text-blue-700 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      System Features
                    </h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Multiple delivery templates</span>
                      </li>
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Real-time profit analysis</span>
                      </li>
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Historical calculation tracking</span>
                      </li>
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Admin configuration interface</span>
                      </li>
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>API integration ready</span>
                      </li>
                      <li className="flex items-start gap-3 text-slate-700">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span>Flexible rule evaluation</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  </div>
);
}
