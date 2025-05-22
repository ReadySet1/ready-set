import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { Database } from '@/types/supabase';
import { UserStatus } from '@/types/supabase';

type UserProfileType = 'vendor' | 'client' | 'admin' | 'super_admin' | 'driver' | 'helpdesk';

// Define default home routes for each user type
const USER_HOME_ROUTES: Record<UserProfileType, string> = {
  admin: "/admin/dashboard",
  super_admin: "/admin/dashboard",
  driver: "/driver/dashboard",
  helpdesk: "/helpdesk/dashboard",
  vendor: "/vendor/dashboard",
  client: "/client/dashboard"
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  try {
    // Get URL parameters
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/';
    const userType = requestUrl.searchParams.get('userType') as UserProfileType | null;
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

    // Get code verifier from cookie
    const codeVerifier = cookieStore.get('code_verifier')?.value;

    if (!codeVerifier) {
      console.error('No code verifier found in cookies');
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/error?error=missing_code_verifier`
      );
    }

    // Exchange code for session
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
          status: UserStatus.PENDING
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
    if (existingProfile.status === UserStatus.PENDING) {
      homeRoute = '/onboarding';
    } else if (existingProfile.user_type) {
      homeRoute = USER_HOME_ROUTES[existingProfile.user_type as UserProfileType] || '/';
    }

    // Create the response with redirect
    const response = NextResponse.redirect(`${requestUrl.origin}${homeRoute}`);

    // Clean up the code verifier cookie
    response.cookies.delete('code_verifier');

    return response;

  } catch (error) {
    console.error('Callback route error:', error);
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/error?error=callback_error`
    );
  }
}