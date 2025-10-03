// Calculator Templates API - CRUD operations for calculator templates
// GET: List all templates, POST: Create new template

import { NextRequest, NextResponse } from 'next/server';
import { CreateTemplateSchema, ConfigurationError } from '@/types/calculator';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/db/prisma';

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

    // Fetch templates from Prisma database
    const templates = await prisma.calculatorTemplate.findMany({
      where: {
        isActive: true
      },
      include: {
        pricingRules: {
          orderBy: {
            priority: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Map Prisma data to our format
    const mappedTemplates = templates.map((template: any) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      pricingRules: template.pricingRules.map((rule: any) => ({
        id: rule.id,
        templateId: rule.templateId,
        ruleType: rule.ruleType,
        ruleName: rule.ruleName,
        baseAmount: rule.baseAmount ? parseFloat(rule.baseAmount.toString()) : undefined,
        perUnitAmount: rule.perUnitAmount ? parseFloat(rule.perUnitAmount.toString()) : undefined,
        thresholdValue: rule.thresholdValue ? parseFloat(rule.thresholdValue.toString()) : undefined,
        thresholdType: rule.thresholdType,
        appliesWhen: rule.appliesWhen ? JSON.parse(rule.appliesWhen) : undefined,
        priority: rule.priority,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt
      }))
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
