import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';

// Define default home routes for each user type
const USER_HOME_ROUTES: Record<string, string> = {
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
  
  // First check if there's an error in the URL (happens when Supabase redirects with an error)
  if (error) {
    console.error('Auth error from Supabase redirect:', {
      error,
      errorCode,
      errorDescription
    });
    
    // Redirect to auth error page with error details
    const errorUrl = new URL('/auth/auth-code-error', requestUrl.origin);
    errorUrl.searchParams.set('error', errorDescription || error);
    errorUrl.searchParams.set('errorCode', errorCode || 'unknown');
    return NextResponse.redirect(errorUrl);
  }
  
  // Add detailed logging for debugging
  console.log('Auth callback received:', { 
    url: requestUrl.toString(),
    code: code ? `${code.substring(0, 5)}...` : 'none', // Log partial code for security
    next
  });
  
  if (code) {
    try {
      const cookieStore = cookies();
      console.log('Creating Supabase client...');
      const supabase = await createSupabaseServerClient();
      
      // Exchange the auth code for a session
      console.log('Exchanging code for session...');
      const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Auth code exchange error:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          code: error.code
        });
        // Redirect to auth error page with error details
        const errorUrl = new URL('/auth/auth-code-error', requestUrl.origin);
        errorUrl.searchParams.set('error', error.message);
        errorUrl.searchParams.set('errorCode', error.code || 'unknown');
        return NextResponse.redirect(errorUrl);
      }
      
      // Log the successful authentication
      console.log('Authentication successful:', session ? 'Session created' : 'No session created');
      
      // If we have a session, determine the correct dashboard based on user role
      if (session) {
        try {
          console.log('Getting user profile for ID:', session.user.id);
          // Get user's role from profiles table
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('type')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error('Error fetching user role:', profileError);
            console.error('Profile error details:', {
              message: profileError.message,
              code: profileError.code,
              details: profileError.details,
              hint: profileError.hint
            });
            
            // Check if it's a "not found" error which might indicate we need to create a profile
            if (profileError.code === 'PGRST116') {
              console.log('Profile not found, may need to create one');
              
              // You could add logic here to create a profile or redirect to a profile creation page
              return NextResponse.redirect(new URL('/complete-profile', requestUrl.origin));
            }
            
            return NextResponse.redirect(new URL(next, requestUrl.origin));
          }

          if (!profile?.type) {
            console.log('Profile found but no type specified, redirecting to default');
            return NextResponse.redirect(new URL(next, requestUrl.origin));
          }

          // Normalize the user type to lowercase for consistent handling
          const userTypeKey = profile.type.toLowerCase();
          console.log('User role for redirection:', userTypeKey);
          
          // Get the appropriate home route for this user type, fallback to next param
          const homeRoute = USER_HOME_ROUTES[userTypeKey] || next;
          console.log('Redirecting to user dashboard:', homeRoute);
          
          // Redirect to the appropriate dashboard
          return NextResponse.redirect(new URL(homeRoute, requestUrl.origin));
        } catch (profileError) {
          console.error('Error in profile lookup:', profileError);
          console.error('Stack trace:', profileError instanceof Error ? profileError.stack : 'No stack trace');
          // Fall back to the provided 'next' parameter
          return NextResponse.redirect(new URL(next, requestUrl.origin));
        }
      }
      
      // Successful auth but no session - redirect to home or requested page
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    } catch (error) {
      console.error('Auth callback error:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Redirect to auth error page
      const errorUrl = new URL('/auth/auth-code-error', requestUrl.origin);
      if (error instanceof Error) {
        errorUrl.searchParams.set('error', error.message);
        errorUrl.searchParams.set('errorType', error.name);
      } else {
        errorUrl.searchParams.set('error', 'Unknown error occurred during authentication');
      }
      return NextResponse.redirect(errorUrl);
    }
  }
  
  // If no code is present, redirect to error page
  console.error('Auth callback received with no code parameter');
  return NextResponse.redirect(new URL('/auth/auth-code-error?error=no_code', requestUrl.origin));
}