// Calculator Templates API - CRUD operations for calculator templates
// GET: List all templates, POST: Create new template

import { NextRequest, NextResponse } from 'next/server';
import { CreateTemplateSchema, ConfigurationError } from '@/types/calculator';
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

    // Fetch templates directly from Supabase
    const { data: templates, error } = await supabase
      .from('calculator_templates')
      .select(`
        *,
        pricing_rules (
          *
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching templates:', error);
      return NextResponse.json(
        { success: false, error: `Failed to fetch templates: ${error.message}` },
        { status: 500 }
      );
    }

    // Map Supabase data to our format
    const mappedTemplates = (templates || []).map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      isActive: template.is_active,
      createdAt: new Date(template.created_at),
      updatedAt: new Date(template.updated_at),
      pricingRules: template.pricing_rules?.map(rule => ({
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
        createdAt: new Date(rule.created_at),
        updatedAt: new Date(rule.updated_at)
      })) || []
    }));
    
    return NextResponse.json({
      success: true,
      data: mappedTemplates,
      total: mappedTemplates.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch calculator templates:', error);
    
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: Implement proper role checking with Supabase user metadata
    // For now, allow all authenticated users to create templates
    
    const body = await request.json();
    
    // Validate input
    const validatedInput = CreateTemplateSchema.parse(body);
    
    const template = await CalculatorService.createTemplate(validatedInput);
    
    return NextResponse.json({
      success: true,
      data: template,
      timestamp: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create calculator template:', error);
    
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
