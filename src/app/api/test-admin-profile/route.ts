import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      return NextResponse.json({ 
        error: 'Profile not found', 
        userId: user.id,
        email: user.email,
        shouldBeAdmin: user.email?.includes('readysetllc.com') || false
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      profile,
      user: {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata
      }
    });
    
  } catch (error) {
    console.error('Test admin profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 