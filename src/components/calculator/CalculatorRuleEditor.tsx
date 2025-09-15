// Calculator Rule Editor - Admin interface for adjusting calculator values
// Allows admins to modify pricing rules and tier configurations

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator, 
  Save, 
  RotateCcw, 
  Settings, 
  DollarSign, 
  Truck,
  AlertTriangle,
  CheckCircle,
  Edit3
} from 'lucide-react';
import { READY_SET_TIERS } from '@/types/calculator';
import type { PricingRule, TierConfiguration } from '@/types/calculator';
import { createClient } from '@/utils/supabase/client';

interface CalculatorRuleEditorProps {
  templateId: string;
  onRuleUpdate?: (rules: PricingRule[]) => void;
  className?: string;
}

export function CalculatorRuleEditor({
  templateId,
  onRuleUpdate,
  className = ''
}: CalculatorRuleEditorProps) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [tierConfig, setTierConfig] = useState<TierConfiguration[]>(READY_SET_TIERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing rules
  useEffect(() => {
    loadRules();
  }, [templateId]);

  // Get authorization headers
  const getAuthHeaders = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  };

  const loadRules = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/calculator/rules?templateId=${templateId}`, {
        headers
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRules(data.data || []);
      } else {
        setError(data.error || 'Failed to load rules');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calculator rules');
      console.error('Error loading rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateRule = (ruleId: string, updates: Partial<PricingRule>) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
    setHasChanges(true);
  };

  const updateTierConfig = (tierIndex: number, updates: Partial<TierConfiguration>) => {
    setTierConfig(prev => prev.map((tier, index) => 
      index === tierIndex ? { ...tier, ...updates } : tier
    ));
    setHasChanges(true);
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      setError(null);

      const headers = await getAuthHeaders();

      // Save rule changes
      for (const rule of rules) {
        const response = await fetch(`/api/calculator/rules/${rule.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            baseAmount: rule.baseAmount,
            perUnitAmount: rule.perUnitAmount,
            thresholdValue: rule.thresholdValue,
            thresholdType: rule.thresholdType
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to update rule ${rule.ruleName}`);
        }
      }

      // Update tier configuration in localStorage for now
      // In production, you'd save this to a dedicated table
      localStorage.setItem('readySetTierConfig', JSON.stringify(tierConfig));

      setSuccess(true);
      setHasChanges(false);
      onRuleUpdate?.(rules);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      console.error('Error saving changes:', err);
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    loadRules();
    setTierConfig(READY_SET_TIERS);
    setHasChanges(false);
    setError(null);
  };

  const getRulesByType = (type: 'customer_charge' | 'driver_payment') => {
    return rules.filter(rule => rule.ruleType === type);
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-4"></div>
          <span>Loading calculator settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="h-6 w-6" />
            Calculator Settings
          </h2>
          <p className="text-gray-600 mt-1">
            Adjust pricing rules and tier configurations for the delivery calculator
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Edit3 className="h-3 w-3" />
              Unsaved Changes
            </Badge>
          )}
          
          <Button
            variant="outline"
            onClick={resetChanges}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          <Button
            onClick={saveChanges}
            disabled={!hasChanges || saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-green-800">
            Calculator settings saved successfully!
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="tiers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tiers" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Tier Configuration
          </TabsTrigger>
          <TabsTrigger value="customer" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Customer Rules
          </TabsTrigger>
          <TabsTrigger value="driver" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Driver Rules
          </TabsTrigger>
        </TabsList>

        {/* Tier Configuration Tab */}
        <TabsContent value="tiers">
          <Card>
            <CardHeader>
              <CardTitle>Ready Set Food Compensation Tiers</CardTitle>
              <p className="text-sm text-gray-600">
                Configure the base fees and pay rates for each tier based on headcount and order value
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {tierConfig.map((tier, index) => (
                  <Card key={tier.tier} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                      <div>
                        <Label className="text-sm font-semibold">Tier {tier.tier}</Label>
                        <div className="text-xs text-gray-500 mt-1">
                          {tier.headcountMin}-{tier.headcountMax || '∞'} people
                          <br />
                          ${tier.foodCostMin}-${tier.foodCostMax || '∞'} order
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor={`customer-${tier.tier}`} className="text-sm">
                          Customer Base Fee
                        </Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id={`customer-${tier.tier}`}
                            type="number"
                            step="0.01"
                            value={tier.customerBaseFee}
                            onChange={(e) => updateTierConfig(index, {
                              customerBaseFee: parseFloat(e.target.value) || 0
                            })}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor={`driver-${tier.tier}`} className="text-sm">
                          Driver Base Pay
                        </Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id={`driver-${tier.tier}`}
                            type="number"
                            step="0.01"
                            value={tier.driverBasePay}
                            onChange={(e) => updateTierConfig(index, {
                              driverBasePay: parseFloat(e.target.value) || 0
                            })}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm">Headcount Range</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={tier.headcountMin}
                            onChange={(e) => updateTierConfig(index, {
                              headcountMin: parseInt(e.target.value) || 0
                            })}
                            className="w-20"
                          />
                          <span className="text-gray-500">-</span>
                          <Input
                            type="number"
                            value={tier.headcountMax || ''}
                            placeholder="∞"
                            onChange={(e) => updateTierConfig(index, {
                              headcountMax: e.target.value ? parseInt(e.target.value) : undefined
                            })}
                            className="w-20"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm">Food Cost Range</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={tier.foodCostMin}
                            onChange={(e) => updateTierConfig(index, {
                              foodCostMin: parseInt(e.target.value) || 0
                            })}
                            className="w-20"
                          />
                          <span className="text-gray-500">-</span>
                          <Input
                            type="number"
                            value={tier.foodCostMax || ''}
                            placeholder="∞"
                            onChange={(e) => updateTierConfig(index, {
                              foodCostMax: e.target.value ? parseInt(e.target.value) : undefined
                            })}
                            className="w-20"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Rules Tab */}
        <TabsContent value="customer">
          <Card>
            <CardHeader>
              <CardTitle>Customer Pricing Rules</CardTitle>
              <p className="text-sm text-gray-600">
                Configure charges applied to customers
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getRulesByType('customer_charge').map((rule) => (
                  <RuleEditor
                    key={rule.id}
                    rule={rule}
                    onUpdate={(updates) => updateRule(rule.id, updates)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Driver Rules Tab */}
        <TabsContent value="driver">
          <Card>
            <CardHeader>
              <CardTitle>Driver Payment Rules</CardTitle>
              <p className="text-sm text-gray-600">
                Configure payments made to drivers
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getRulesByType('driver_payment').map((rule) => (
                  <RuleEditor
                    key={rule.id}
                    rule={rule}
                    onUpdate={(updates) => updateRule(rule.id, updates)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Individual Rule Editor Component
function RuleEditor({ 
  rule, 
  onUpdate 
}: { 
  rule: PricingRule; 
  onUpdate: (updates: Partial<PricingRule>) => void;
}) {
  const getRuleDisplayName = (ruleName: string) => {
    const names: Record<string, string> = {
      'tiered_base_fee': 'Tiered Base Fee',
      'tiered_base_pay': 'Tiered Base Pay',
      'long_distance': 'Long Distance Charge',
      'bridge_toll': 'Bridge Toll',
      'mileage': 'Mileage Pay',
      'tips': 'Tip Pass-through'
    };
    return names[ruleName] || ruleName;
  };

  const getRuleDescription = (ruleName: string) => {
    const descriptions: Record<string, string> = {
      'tiered_base_fee': 'Base fee charged to customers based on tier (uses tier configuration above)',
      'tiered_base_pay': 'Base pay given to drivers based on tier (uses tier configuration above)',
      'long_distance': 'Additional charge per mile for distances above threshold',
      'bridge_toll': 'Fixed fee for bridge crossings',
      'mileage': 'Additional pay per mile for drivers above threshold',
      'tips': 'Pass-through of customer tips to drivers'
    };
    return descriptions[ruleName] || 'Custom pricing rule';
  };

  const isFixedRule = rule.ruleName === 'tiered_base_fee' || rule.ruleName === 'tiered_base_pay';

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold">{getRuleDisplayName(rule.ruleName)}</h4>
          <p className="text-sm text-gray-600">{getRuleDescription(rule.ruleName)}</p>
          <Badge variant="outline" className="mt-2">
            Priority: {rule.priority}
          </Badge>
        </div>
      </div>

      {isFixedRule ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This rule uses the tier configuration above. Adjust the tier values in the "Tier Configuration" tab.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor={`base-${rule.id}`}>Base Amount ($)</Label>
            <Input
              id={`base-${rule.id}`}
              type="number"
              step="0.01"
              value={rule.baseAmount || ''}
              onChange={(e) => onUpdate({ 
                baseAmount: e.target.value ? parseFloat(e.target.value) : undefined 
              })}
              placeholder="0.00"
            />
          </div>
          
          <div>
            <Label htmlFor={`unit-${rule.id}`}>Per Unit Amount ($)</Label>
            <Input
              id={`unit-${rule.id}`}
              type="number"
              step="0.01"
              value={rule.perUnitAmount || ''}
              onChange={(e) => onUpdate({ 
                perUnitAmount: e.target.value ? parseFloat(e.target.value) : undefined 
              })}
              placeholder="0.00"
            />
          </div>
          
          <div>
            <Label htmlFor={`threshold-${rule.id}`}>Threshold Value</Label>
            <Input
              id={`threshold-${rule.id}`}
              type="number"
              step="0.01"
              value={rule.thresholdValue || ''}
              onChange={(e) => onUpdate({ 
                thresholdValue: e.target.value ? parseFloat(e.target.value) : undefined 
              })}
              placeholder="0"
            />
          </div>
          
          <div>
            <Label htmlFor={`type-${rule.id}`}>Threshold Type</Label>
            <select
              id={`type-${rule.id}`}
              value={rule.thresholdType || ''}
              onChange={(e) => onUpdate({ thresholdType: e.target.value ? e.target.value as 'above' | 'below' | 'between' : undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">None</option>
              <option value="above">Above</option>
              <option value="below">Below</option>
              <option value="between">Between</option>
            </select>
          </div>
        </div>
      )}
    </Card>
  );
}
