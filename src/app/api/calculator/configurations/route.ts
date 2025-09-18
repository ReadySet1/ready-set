// Client Configurations API - CRUD operations for client-specific calculator configurations
// GET: List configurations, POST: Create new configuration

import { NextRequest, NextResponse } from 'next/server';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { CreateClientConfigSchema, ConfigurationError } from '@/types/calculator';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Use session-based authentication (consistent with other endpoints)
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile from Supabase to check type
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, type')
      .eq('email', authUser.email!)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || undefined;

    // Non-admin users can only see their own configurations
    const effectiveClientId = ['ADMIN', 'SUPER_ADMIN'].includes(userProfile.type) 
      ? clientId 
      : userProfile.id;

    const configurations = await CalculatorService.getClientConfigurations(supabase, effectiveClientId);
    
    return NextResponse.json({
      success: true,
      data: configurations,
      total: configurations.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch client configurations:', error);
    
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
    // Use session-based authentication (consistent with other endpoints)
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile from Supabase to check type
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, type')
      .eq('email', authUser.email!)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Check if user has admin privileges or is creating for themselves
    const body = await request.json();
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userProfile.type);
    
    if (!isAdmin && body.clientId && body.clientId !== userProfile.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot create configuration for other users' },
        { status: 403 }
      );
    }

    // If not admin and no clientId specified, use current user
    if (!isAdmin && !body.clientId) {
      body.clientId = userProfile.id;
    }
    
    // Validate input
    const validatedInput = CreateClientConfigSchema.parse(body);
    
    const configuration = await CalculatorService.createClientConfig(supabase, validatedInput);
    
    return NextResponse.json({
      success: true,
      data: configuration,
      timestamp: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create client configuration:', error);
    
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
