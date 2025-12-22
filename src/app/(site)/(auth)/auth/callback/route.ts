import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import { setSentryUser } from '@/lib/monitoring/sentry';

// Define default home routes for each user type
const USER_HOME_ROUTES: Record<string, string> = {
  admin: "/admin",
  super_admin: "/admin",
  driver: "/driver",
  helpdesk: "/helpdesk",
  vendor: "/client",
  client: "/client"
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';
  // Capture userType from signup flow (passed by GoogleAuthButton)
  const userTypeParam = requestUrl.searchParams.get('userType');
  
  if (code) {
    try {
      const cookieStore = cookies();
      const supabase = await createSupabaseServerClient();
      
      // Exchange the auth code for a session
      const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Auth code exchange error:', error);
        // Redirect to auth error page with error details
        const errorUrl = new URL('/auth/auth-code-error', requestUrl.origin);
        errorUrl.searchParams.set('error', error.message);
        return NextResponse.redirect(errorUrl);
      }
      
      // Log the successful authentication
            
      // If we have a session, determine where to redirect
      if (session) {
        // If 'next' is explicitly set (e.g., for password reset), use it directly
        // This allows password reset flow to work without being redirected to dashboard
        if (next && next !== '/' && next.startsWith('/')) {
          // Set Sentry user context for error tracking
          setSentryUser({
            id: session.user.id,
            email: session.user.email || undefined,
            role: undefined
          });
          return NextResponse.redirect(new URL(next, requestUrl.origin));
        }

        try {
          // Get user's role from profiles table (or create if missing)
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('type')
            .eq('id', session.user.id)
            .maybeSingle();

          let userType = profile?.type;

          // If no profile exists, create one with default values
          if (profileError || !profile) {

            try {
              // Determine user type: use userType from signup flow, or default to CLIENT
              const resolvedUserType = userTypeParam?.toUpperCase() === 'VENDOR' ? 'VENDOR' :
                                       userTypeParam?.toUpperCase() === 'CLIENT' ? 'CLIENT' :
                                       'CLIENT'; // Default to CLIENT if not specified

              // Create a default profile for the user
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email || '',
                  name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                  type: resolvedUserType, // Use userType from signup flow
                  status: 'ACTIVE',
                  updatedAt: new Date().toISOString()
                })
                .select('type')
                .single();

              if (createError) {
                console.error('Error creating default profile:', createError);
                return NextResponse.redirect(new URL(next, requestUrl.origin));
              }

              userType = newProfile?.type;
                          } catch (createProfileError) {
              console.error('Exception creating default profile:', createProfileError);
              return NextResponse.redirect(new URL(next, requestUrl.origin));
            }
          }

          if (!userType) {
            console.error('No user type found after profile creation');
            return NextResponse.redirect(new URL(next, requestUrl.origin));
          }

          // Normalize the user type to lowercase for consistent handling
          const userTypeKey = userType.toLowerCase();

          // Set Sentry user context for error tracking
          setSentryUser({
            id: session.user.id,
            email: session.user.email || undefined,
            role: userType
          });

          // Get the appropriate home route for this user type, fallback to next param
          const homeRoute = USER_HOME_ROUTES[userTypeKey] || next;

          // Redirect to the appropriate dashboard
          return NextResponse.redirect(new URL(homeRoute, requestUrl.origin));
        } catch (profileError) {
          console.error('Error in profile lookup:', profileError);
          // Fall back to the provided 'next' parameter
          return NextResponse.redirect(new URL(next, requestUrl.origin));
        }
      }
      
      // Successful auth but no session - redirect to home or requested page
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    } catch (error) {
      console.error('Auth callback error:', error);
      // Redirect to auth error page
      const errorUrl = new URL('/auth/auth-code-error', requestUrl.origin);
      if (error instanceof Error) {
        errorUrl.searchParams.set('error', error.message);
      }
      return NextResponse.redirect(errorUrl);
    }
  }
  
  // If no code is present, redirect to error page
  return NextResponse.redirect(new URL('/auth/auth-code-error?error=no_code', requestUrl.origin));
}