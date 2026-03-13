// Calculator Calculation API - Performs delivery cost calculations
// POST: Calculate delivery costs using template and input data

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { CalculationInputSchema, ConfigurationError, CalculatorError } from '@/types/calculator';
import { createClient } from '@/utils/supabase/server';

const AUTH_TIMEOUT_MS = 3000;

/**
 * Authenticates via getUser() with a short timeout to avoid hanging
 * when Supabase auth servers are unreachable.
 * Throws on timeout or network error.
 */
async function authenticateRequest(supabase: Awaited<ReturnType<typeof createClient>>) {
  return Promise.race([
    supabase.auth.getUser(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AUTH_TIMEOUT')), AUTH_TIMEOUT_MS)
    )
  ]);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    let user;
    try {
      const { data, error } = await authenticateRequest(supabase);
      if (error || !data?.user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      user = data.user;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Authentication service temporarily unavailable. Please try again.' },
        { status: 503 }
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

    const validatedInput = CalculationInputSchema.parse({
      ...inputData,
      customFields: {
        ...inputData.customFields,
        userId: user.id
      }
    });

    const result = await CalculatorService.calculate(
      supabase,
      templateId,
      validatedInput,
      clientConfigId,
      user.id
    );

    if (saveHistory) {
      await CalculatorService.saveCalculationHistory(
        supabase,
        templateId,
        validatedInput,
        result,
        clientConfigId,
        user.id
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

    let user;
    try {
      const { data, error } = await authenticateRequest(supabase);
      if (error || !data?.user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      user = data.user;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Authentication service temporarily unavailable. Please try again.' },
        { status: 503 }
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
