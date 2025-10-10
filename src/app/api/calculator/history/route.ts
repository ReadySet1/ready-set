// Calculation History API - Retrieves historical calculation data
// GET: List calculation history with filtering options

import { NextRequest, NextResponse } from 'next/server';
import { CalculatorService } from '@/lib/calculator/calculator-service';
import { ConfigurationError } from '@/types/calculator';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';

export async function GET(request: NextRequest) {
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

    // Get user profile from database
    const userProfile = await prisma.profile.findUnique({
      where: { email: authUser.email! },
      select: { id: true, type: true }
    });

    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');

    // Non-admin users can only see their own history
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(userProfile.type || '');
    const effectiveUserId = isAdmin ? userId : userProfile.id;

    // Validate limit
    const validatedLimit = Math.min(Math.max(limit, 1), 100); // Between 1 and 100

    const history = await CalculatorService.getCalculationHistory(
      supabase,
      {
        userId: effectiveUserId,
        templateId,
        limit: validatedLimit
      }
    );
    
    console.log('📊 History API Debug:', {
      effectiveUserId,
      templateId,
      limit: validatedLimit,
      historyCount: history.length,
      history: history.slice(0, 2) // Show first 2 entries for debugging
    });
    
    return NextResponse.json({
      success: true,
      data: history,
      total: history.length,
      limit: validatedLimit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to fetch calculation history:', error);
    
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
