// src/app/api/auth/current-user/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Force dynamic mode to ensure auth is checked on every request
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Use await with createClient since your implementation returns a Promise
    const supabase = await createClient();
    
    // Get the current authenticated user
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if user profile exists and is not soft-deleted
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('deletedAt')
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
    
    // Return the user data
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error checking authentication:', error);
    return NextResponse.json(
      { error: 'Authentication error' },
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