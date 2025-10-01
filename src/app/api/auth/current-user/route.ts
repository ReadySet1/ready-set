// src/app/api/auth/current-user/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSessionManager } from '@/lib/auth/session-manager';
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

    // Validate enhanced session if available
    try {
      const sessionManager = getSessionManager();
      const isValid = await sessionManager.validateSession();

      if (!isValid) {
        return NextResponse.json(
          { error: 'Session validation failed', code: AuthErrorType.SESSION_INVALID },
          { status: 401 }
        );
      }
    } catch (sessionError) {
      console.warn('Session validation warning:', sessionError);
      // Continue with basic auth check if enhanced session validation fails
    }

    // Get user profile data for enhanced response
    let profile = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('type, email, name, status')
        .eq('id', user.id)
        .single();

      if (!profileError && profileData) {
        profile = profileData;
      }
    } catch (profileErr) {
      console.warn('Failed to fetch user profile:', profileErr);
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