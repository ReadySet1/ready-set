import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Define user types and their corresponding routes
const USER_HOME_ROUTES = {
  admin: "/admin/dashboard",
  super_admin: "/admin/dashboard",
  driver: "/driver/dashboard",
  helpdesk: "/helpdesk/dashboard",
  vendor: "/vendor/dashboard",
  client: "/client/dashboard"
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const supabase = createClient();
  
  try {
    // Get URL parameters
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/';
    const userType = requestUrl.searchParams.get('userType');
    const mode = requestUrl.searchParams.get('mode') || 'signup';
    const error = requestUrl.searchParams.get('error') || 'none';
    const errorCode = requestUrl.searchParams.get('error_code') || 'none';

    console.log('Auth callback received:', {
      url: request.url,
      code: code ? `${code.substring(0, 5)}...` : undefined,
      next,
      userType,
      mode,
      error,
      errorCode
    });

    if (error !== 'none' || !code) {
      console.error('Auth callback error:', { error, errorCode });
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/error?error=${error}&error_code=${errorCode}`
      );
    }

    // Exchange code for session (PKCE flow handled by Supabase)
    const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError) {
      console.error('Session exchange error:', sessionError);
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/error?error=${sessionError.message}`
      );
    }

    if (!data.session?.user) {
      console.error('No user in session after exchange');
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/error?error=no_user_in_session`
      );
    }

    const session = data.session;

    // Get or create profile
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!existingProfile) {
      // Create new profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata.full_name,
          avatar_url: session.user.user_metadata.avatar_url,
          user_type: userType || 'client',
          status: 'pending'
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        return NextResponse.redirect(
          `${requestUrl.origin}/auth/error?error=profile_creation_failed`
        );
      }

      // Redirect new users to onboarding
      return NextResponse.redirect(`${requestUrl.origin}/onboarding`);
    }

    // Determine home route based on user type and status
    let homeRoute = '/';
    if (existingProfile.status === 'pending') {
      homeRoute = '/onboarding';
    } else if (existingProfile.user_type && existingProfile.user_type in USER_HOME_ROUTES) {
      homeRoute = USER_HOME_ROUTES[existingProfile.user_type as keyof typeof USER_HOME_ROUTES];
    }

    // Create the response with redirect
    return NextResponse.redirect(`${requestUrl.origin}${homeRoute}`);

  } catch (error) {
    console.error('Callback route error:', error);
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/error?error=callback_error`
    );
  }
}