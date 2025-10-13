// src/app/api/auth/current-user/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuthError, AuthErrorType } from '@/types/auth';

// Force dynamic mode to ensure auth is checked on every request
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Use await with createClient since your implementation returns a Promise
    const supabase = await createClient();

    // Get the current authenticated user
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('Authentication error:', error);

      // Handle specific auth errors
      if (error.message?.includes('JWT') || error.message?.includes('token')) {
        return NextResponse.json(
          { error: 'Invalid or expired token', code: AuthErrorType.TOKEN_INVALID },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: 'Authentication failed', code: AuthErrorType.TOKEN_INVALID },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated', code: AuthErrorType.TOKEN_INVALID },
        { status: 401 }
      );
    }

    // Check if user profile exists and is not soft-deleted
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('type, email, name, status, deletedAt')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Unable to verify account status' },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Check if user account has been soft-deleted
    if (profile.deletedAt) {
      return NextResponse.json(
        { error: 'Account has been deactivated' },
        { status: 403 }
      );
    }

    // Return enhanced user data
    const response = {
      ...user,
      profile,
      sessionInfo: {
        validated: true,
        timestamp: new Date().toISOString(),
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error checking authentication:', error);
    return NextResponse.json(
      { error: 'Authentication error', code: AuthErrorType.SERVER_ERROR },
      { status: 500 }
    );
  }
}

// Ensure this route isn't intercepted by middleware
export const config = {
  api: {
    bodyParser: true,
  },
};