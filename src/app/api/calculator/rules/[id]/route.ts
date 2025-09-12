// Individual Pricing Rule API - CRUD operations for specific rule
// PUT: Update rule, DELETE: Delete rule

import { NextRequest, NextResponse } from 'next/server';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { CreateRuleSchema, ConfigurationError } from '@/types/calculator';
import { createClient } from '@/utils/supabase/server';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid authorization header' },
        { status: 401 }
      );
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Verify the token by getting the user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // For updating rules, just ensure authenticated user (admin check can be added later)
    // Currently allowing authenticated users to update rules for development

    const body = await request.json();
    
    // Validate input (partial update allowed)
    const validatedInput = CreateRuleSchema.partial().parse(body);
    
    const rule = await CalculatorService.updateRule(params.id, validatedInput);
    
    return NextResponse.json({
      success: true,
      data: rule,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to update pricing rule:', error);
    
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid authorization header' },
        { status: 401 }
      );
    }

    // Extract the token
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Verify the token by getting the user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // For deleting rules, just ensure authenticated user (admin check can be added later)
    // Currently allowing authenticated users to delete rules for development

    await CalculatorService.deleteRule(params.id);
    
    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to delete pricing rule:', error);
    
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
