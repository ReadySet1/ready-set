// Calculator Configuration API - Gets complete calculator configuration
// GET: Retrieve calculator configuration for a specific template and client config

import { NextRequest, NextResponse } from 'next/server';
import { ConfigurationError } from '@/types/calculator';
import { createClient } from '@/utils/supabase/server';

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

    console.log('🔍 Fetching template:', templateId);
    
    // Get template with rules using Supabase directly (consistent with templates API)
    const { data: template, error: templateError } = await supabase
      .from('calculator_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    console.log('📋 Template query result:', { template, templateError });

    if (templateError || !template) {
      console.error('❌ Error fetching template:', templateError);
      
      // Try to fetch all templates to see what's available for debugging
      const { data: allTemplates, error: allError } = await supabase
        .from('calculator_templates')
        .select('id, name, description, is_active');
        
      console.log('📋 All available templates:', allTemplates);
      console.log('🔍 Template fetch error details:', allError);
      
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

    console.log('📏 Rules query result:', { rulesCount: rules?.length || 0, rulesError });

    if (rulesError) {
      console.error('❌ Error fetching rules:', rulesError);
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
    let clientConfig = null;
    if (clientConfigId) {
      const { data: configs, error: configError } = await supabase
        .from('client_configurations')
        .select('*')
        .eq('id', clientConfigId)
        .single();

      if (!configError && configs) {
        clientConfig = {
          id: configs.id,
          clientId: configs.client_id,
          templateId: configs.template_id,
          clientName: configs.client_name,
          ruleOverrides: configs.rule_overrides || {},
          areaRules: configs.area_rules || [],
          isActive: configs.is_active,
          createdAt: configs.created_at,
          updatedAt: configs.updated_at
        };
      }
    }

    const config = {
      template: templateWithRules,
      rules: templateWithRules.pricingRules || [],
      clientConfig,
      areaRules: clientConfig?.areaRules || []
    };
    
    console.log('✅ Successfully fetched calculator configuration:', {
      templateName: templateWithRules.name,
      rulesCount: config.rules.length,
      hasClientConfig: !!clientConfig
    });
    
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
