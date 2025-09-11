// Calculator Configuration API - Gets complete calculator configuration
// GET: Retrieve calculator configuration for a specific template and client config

import { NextRequest, NextResponse } from 'next/server';
import { CalculatorService } from '@/lib/calculator/calculator-service';
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

    // Get template with rules
    const template = await CalculatorService.getTemplateWithRules(supabase, templateId);
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Calculator template not found' },
        { status: 404 }
      );
    }

    // Get client configuration if specified
    let clientConfig = null;
    if (clientConfigId) {
      const configs = await CalculatorService.getClientConfigurations(supabase, undefined);
      clientConfig = configs.find(config => config.id === clientConfigId) || null;
    }

    const config = {
      template,
      rules: template.pricingRules || [],
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
