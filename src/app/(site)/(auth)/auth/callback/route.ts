import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { Database } from '@/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
type UserType = NonNullable<Profile['type']>;

// Define default home routes for each user type
const USER_HOME_ROUTES: Record<Lowercase<UserType>, string> = {
  admin: "/admin",
  super_admin: "/admin",
  driver: "/driver",
  helpdesk: "/helpdesk",
  vendor: "/vendor",
  client: "/client"
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorCode = requestUrl.searchParams.get('error_code');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const next = requestUrl.searchParams.get('next') || '/';
  const userType = requestUrl.searchParams.get('userType')?.toUpperCase() as UserType;
  const mode = requestUrl.searchParams.get('mode') || 'signup';
  
  // Add detailed logging for debugging
  console.log('Auth callback received:', { 
    url: requestUrl.toString(),
    code: code ? `${code.substring(0, 5)}...` : 'none',
    next,
    userType,
    mode,
    error: error || 'none',
    errorCode: errorCode || 'none'
  });

  // Helper function to create error redirect URL
  const createErrorRedirectUrl = (error: string, code: string = 'unknown') => {
    const errorUrl = new URL('/auth/auth-code-error', requestUrl.origin);
    errorUrl.searchParams.set('error', error);
    errorUrl.searchParams.set('errorCode', code);
    return errorUrl;
  };

  try {
    const supabase = await createClient();

    if (error || errorCode) {
      console.error('Auth error from provider:', {
        error,
        errorCode,
        errorDescription
      });
      return NextResponse.redirect(createErrorRedirectUrl(
        errorDescription || error || 'Unknown authentication error',
        errorCode || 'oauth_error'
      ));
    }

    if (!code) {
      console.error('No authorization code received');
      return NextResponse.redirect(createErrorRedirectUrl(
        'No authorization code received',
        'no_code'
      ));
    }

    // Exchange the code for a session using PKCE flow
    const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Session exchange error:', exchangeError);
      return NextResponse.redirect(createErrorRedirectUrl(
        exchangeError.message,
        'session_exchange_failed'
      ));
    }

    if (!session?.user) {
      console.error('No user session created');
      return NextResponse.redirect(createErrorRedirectUrl(
        'Failed to create user session',
        'no_session'
      ));
    }

    // Get or create user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select()
      .eq('id', session.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching profile:', profileError);
      return NextResponse.redirect(createErrorRedirectUrl(
        'Failed to fetch user profile',
        'profile_fetch_failed'
      ));
    }

    // Create profile if it doesn't exist
    if (!profile) {
      const newProfile: ProfileInsert = {
        id: session.user.id,
        email: session.user.email,
        full_name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || null,
        type: userType || 'CLIENT',
        status: 'PENDING'
      };

      const { error: createProfileError } = await supabase
        .from('profiles')
        .insert(newProfile);

      if (createProfileError) {
        console.error('Error creating profile:', createProfileError);
        return NextResponse.redirect(createErrorRedirectUrl(
          'Failed to create user profile',
          'profile_creation_failed'
        ));
      }

      // Redirect new users to complete their profile
      const completeProfileUrl = new URL('/complete-profile', requestUrl.origin);
      completeProfileUrl.searchParams.set('mode', mode);
      return NextResponse.redirect(completeProfileUrl);
    }

    // Handle existing profiles
    if (profile.status === 'PENDING') {
      const completeProfileUrl = new URL('/complete-profile', requestUrl.origin);
      completeProfileUrl.searchParams.set('mode', mode);
      return NextResponse.redirect(completeProfileUrl);
    }

    if (profile.status === 'SUSPENDED') {
      return NextResponse.redirect(createErrorRedirectUrl(
        'Your account has been suspended. Please contact support.',
        'account_suspended'
      ));
    }

    // Determine the home route based on user type
    const userHomeRoute = profile.type ? 
      USER_HOME_ROUTES[profile.type.toLowerCase() as Lowercase<UserType>] : 
      '/';
    
    const redirectUrl = new URL(userHomeRoute || next, requestUrl.origin);

    // Add success parameter for UI feedback
    redirectUrl.searchParams.set('auth_success', 'true');

    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('Unhandled error in auth callback:', error);
    return NextResponse.redirect(createErrorRedirectUrl(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      'unhandled_error'
    ));
  }
}