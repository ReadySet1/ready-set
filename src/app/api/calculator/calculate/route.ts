// Calculator Calculation API - Performs delivery cost calculations
// POST: Calculate delivery costs using template and input data

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { CalculationInputSchema, ConfigurationError, CalculatorError } from '@/types/calculator';
import { createClient } from '@/utils/supabase/server';

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

    const body = await request.json();
    const { templateId, clientConfigId, saveHistory = false, ...inputData } = body;

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Validate calculation input
    const validatedInput = CalculationInputSchema.parse({
      ...inputData,
      customFields: {
        ...inputData.customFields,
        userId: user?.id || 'test-user'
      }
    });

    // Debug: Check what template we're trying to load
    
    // Perform calculation
    const result = await CalculatorService.calculate(
      supabase,
      templateId,
      validatedInput,
      clientConfigId,
      user?.id || 'test-user'
    );

    
    // Save to history if requested
    if (saveHistory) {
      await CalculatorService.saveCalculationHistory(
        supabase,
        templateId,
        validatedInput,
        result,
        clientConfigId,
        user?.id || 'test-user'
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'calculator-calculate-post' },
    });

    if (error instanceof ConfigurationError || error instanceof CalculatorError) {
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

// GET endpoint for retrieving calculator configuration for UI
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
    const clientConfigId = searchParams.get('clientConfigId') || undefined;

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const config = await CalculatorService.getCalculatorConfig(templateId, clientConfigId);
    
    return NextResponse.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'calculator-calculate-get' },
    });

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
