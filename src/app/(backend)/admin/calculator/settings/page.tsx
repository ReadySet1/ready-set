// Calculator Settings Page - Admin interface for managing calculator configuration
// Allows admins to adjust pricing rules, tiers, and calculator behavior

'use client';

import { useState, useEffect } from 'react';
import { CalculatorRuleEditor } from '@/components/calculator/CalculatorRuleEditor';
import { useCalculatorConfig } from '@/hooks/useCalculatorConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator, 
  Settings, 
  Eye, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function CalculatorSettingsPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [previewMode, setPreviewMode] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load available templates
  const { 
    templates, 
    isLoadingTemplates, 
    error: templatesError 
  } = useCalculatorConfig({ autoLoad: true });

  // Auto-select Ready Set Food template
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      const readySetTemplate = templates.find(t => 
        t.name === 'Ready Set Food Standard Delivery'
      );
      const fallbackTemplate = templates.find(t => 
        t.name === 'Standard Delivery'
      );
      const defaultTemplate = readySetTemplate || fallbackTemplate || templates[0];
      
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      }
    }
  }, [templates, selectedTemplateId]);

  const handleRuleUpdate = () => {
    setLastSaved(new Date());
  };

  const openPreview = () => {
    setPreviewMode(true);
    // Open calculator in a new tab
    window.open('/admin/calculator', '_blank');
  };

  if (isLoadingTemplates) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-4"></div>
          <span>Loading calculator settings...</span>
        </div>
      </div>
    );
  }

  if (templatesError) {
    return (
      <div className="container mx-auto py-8">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            <strong>Error Loading Templates</strong>
            <br />
            {templatesError}
            <br />
            Please check your database connection and ensure the calculator system is properly set up.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link 
              href="/admin/calculator" 
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Settings className="h-8 w-8" />
              Calculator Settings
            </h1>
          </div>
          <p className="text-gray-600">
            Configure pricing rules, tiers, and calculator behavior for delivery calculations
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {lastSaved && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Saved {lastSaved.toLocaleTimeString()}
            </Badge>
          )}
          
          <Button
            variant="outline"
            onClick={openPreview}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview Calculator
          </Button>
        </div>
      </div>

      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Template Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map(template => (
              <Card 
                key={template.id} 
                className={`cursor-pointer transition-all ${
                  selectedTemplateId === template.id 
                    ? 'ring-2 ring-blue-500 bg-blue-50' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{template.name}</h3>
                    {selectedTemplateId === template.id && (
                      <Badge variant="default">Selected</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {template.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Rules: {template.pricingRules?.length || 0}</span>
                    <span>{template.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rule Editor */}
      {selectedTemplateId && selectedTemplate && (
        <div className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50">
            <Calculator className="h-4 w-4" />
            <AlertDescription className="text-blue-800">
              <strong>Editing: {selectedTemplate.name}</strong>
              <br />
              Changes will affect all calculations using this template. 
              Test thoroughly before applying to production.
            </AlertDescription>
          </Alert>

          <CalculatorRuleEditor
            templateId={selectedTemplateId}
            onRuleUpdate={handleRuleUpdate}
            className="space-y-6"
          />
        </div>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Calculator Settings Help</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Tier Configuration</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Set base fees customers pay for each tier</li>
                <li>• Configure base pay drivers receive for each tier</li>
                <li>• Adjust headcount and order value ranges</li>
                <li>• Lower tier is used when headcount and order suggest different tiers</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Pricing Rules</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Base Amount: Fixed fee applied</li>
                <li>• Per Unit Amount: Rate multiplied by applicable units</li>
                <li>• Threshold: Minimum value before rule applies</li>
                <li>• Priority: Higher priority rules are processed first</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Key Rules</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• <strong>Long Distance:</strong> $3/mile for customer, miles {'>'}10</li>
                <li>• <strong>Mileage:</strong> $0.35/mile for driver, miles {'>'} 10</li>
                <li>• <strong>Bridge Toll:</strong> $8 fee when bridge required</li>
                <li>• <strong>Tips:</strong> 100% pass-through to driver</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Testing</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Use "Preview Calculator" to test changes</li>
                <li>• Test Scenario 1: 20 people, $250, 8 miles</li>
                <li>• Expected: Customer $65, Driver $35</li>
                <li>• Verify tip logic: tips OR bonus structure, never both</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
