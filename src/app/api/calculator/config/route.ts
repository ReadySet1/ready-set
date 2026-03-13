// Calculator Configuration API - Gets complete calculator configuration
// GET: Retrieve calculator configuration for a specific template and client config

import { NextRequest, NextResponse } from 'next/server';
import { ConfigurationError } from '@/types/calculator';
import { createClient } from '@/utils/supabase/server';
import { getConfiguration } from '@/lib/calculator/client-configurations';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const clientConfigId = searchParams.get('clientConfigId');

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      );
    }
    
    // Get template with rules using Supabase directly (consistent with templates API)
    const { data: template, error: templateError } = await supabase
      .from('calculator_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { success: false, error: 'Calculator template not found' },
        { status: 404 }
      );
    }

    // Get pricing rules for the template
    const { data: rules, error: rulesError } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('template_id', templateId)
      .order('priority', { ascending: false });

    if (rulesError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch pricing rules' },
        { status: 500 }
      );
    }

    // Format the template with rules (matching the expected structure)
    const templateWithRules = {
      id: template.id,
      name: template.name,
      description: template.description,
      isActive: template.is_active,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
      pricingRules: (rules || []).map((rule: any) => ({
        id: rule.id,
        templateId: rule.template_id,
        ruleType: rule.rule_type,
        ruleName: rule.rule_name,
        baseAmount: rule.base_amount ? parseFloat(rule.base_amount.toString()) : undefined,
        perUnitAmount: rule.per_unit_amount ? parseFloat(rule.per_unit_amount.toString()) : undefined,
        thresholdValue: rule.threshold_value ? parseFloat(rule.threshold_value.toString()) : undefined,
        thresholdType: rule.threshold_type,
        appliesWhen: rule.applies_when ? JSON.parse(rule.applies_when) : undefined,
        priority: rule.priority,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at
      }))
    };

    // Get client configuration if specified
    // First try in-memory configurations (which have the full pricing details)
    // Then fall back to database if not found
    let clientConfig = null;
    if (clientConfigId) {
      // Try in-memory config first (has complete pricing data including zeroOrderSettings)
      const inMemoryConfig = getConfiguration(clientConfigId);
      
      if (inMemoryConfig) {
        clientConfig = {
          id: inMemoryConfig.id,
          clientId: inMemoryConfig.id,
          templateId: template.id,
          clientName: inMemoryConfig.clientName,
          vendorName: inMemoryConfig.vendorName,
          ruleOverrides: {},
          areaRules: [],
          isActive: inMemoryConfig.isActive,
          // Include the full configuration for use in calculations
          pricingTiers: inMemoryConfig.pricingTiers,
          mileageRate: inMemoryConfig.mileageRate,
          distanceThreshold: inMemoryConfig.distanceThreshold,
          dailyDriveDiscounts: inMemoryConfig.dailyDriveDiscounts,
          driverPaySettings: inMemoryConfig.driverPaySettings,
          bridgeTollSettings: inMemoryConfig.bridgeTollSettings,
          zeroOrderSettings: inMemoryConfig.zeroOrderSettings,
          createdAt: inMemoryConfig.createdAt,
          updatedAt: inMemoryConfig.updatedAt
        };
      } else {
        // Fall back to database lookup
        const { data: configs, error: configError } = await supabase
          .from('client_configurations')
          .select('*')
          .eq('id', clientConfigId)
          .single();

        if (!configError && configs) {
          clientConfig = {
            id: configs.id,
            clientId: configs.client_id,
            templateId: configs.template_id || template.id,
            clientName: configs.client_name,
            ruleOverrides: configs.rule_overrides || {},
            areaRules: configs.area_rules || [],
            isActive: configs.is_active,
            createdAt: configs.created_at,
            updatedAt: configs.updated_at
          };
        }
      }
    }

    const config = {
      template: templateWithRules,
      rules: templateWithRules.pricingRules || [],
      clientConfig,
      areaRules: clientConfig?.areaRules || []
    };

    return NextResponse.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch calculator configuration:', error);
    
    if (error instanceof ConfigurationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
