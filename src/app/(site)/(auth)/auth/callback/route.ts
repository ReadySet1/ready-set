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

// Helper function to determine if user should be admin based on email
function shouldBeAdmin(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  const adminDomains = process.env.ADMIN_DOMAINS?.split(',').map(d => d.trim().toLowerCase()) || [];
  
  const emailLower = email.toLowerCase();
  
  // Check exact email match (including existing ADMIN_EMAIL)
  if (adminEmail && emailLower === adminEmail) {
    return true;
  }
  
  if (adminEmails.includes(emailLower)) {
    return true;
  }
  
  // Check domain match
  const domain = emailLower.split('@')[1];
  if (domain && adminDomains.includes(domain)) {
    return true;
  }
  
  return false;
}

// Enhanced helper function to create user profile with retry logic
async function createUserProfile(supabase: any, user: any, userType?: string) {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const email = user.email;
      const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];
      const image = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      
      // Determine user type
      let type = userType || 'client';
      if (shouldBeAdmin(email)) {
        type = 'admin';
      }
      
      console.log(`[OAuth Callback] Creating profile for user ${user.id} with type: ${type} (attempt ${attempt}/${maxRetries})`);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: email,
          name: name,
          image: image,
          type: type,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error(`[OAuth Callback] Error creating profile (attempt ${attempt}):`, error);
        
        // If it's a unique constraint violation, the profile might already exist
        if (error.code === '23505' && attempt === 1) {
          console.log('[OAuth Callback] Profile might already exist, attempting to fetch existing profile');
          const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
          if (!fetchError && existingProfile) {
            console.log('[OAuth Callback] Found existing profile:', existingProfile);
            return existingProfile;
          }
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[OAuth Callback] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.log('[OAuth Callback] Profile created successfully:', profile);
      return profile;
    } catch (error) {
      console.error(`[OAuth Callback] Failed to create user profile (attempt ${attempt}):`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[OAuth Callback] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Failed to create user profile after all retry attempts');
}

// Enhanced function to fetch user profile with retry logic
async function fetchUserProfileWithRetry(supabase: any, userId: string, maxRetries: number = 3) {
  const baseDelay = 500; // 500ms base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[OAuth Callback] Fetching profile for user ${userId} (attempt ${attempt}/${maxRetries})`);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.error(`[OAuth Callback] Error fetching profile (attempt ${attempt}):`, error);
        
        if (error.code === 'PGRST116') {
          // No rows returned - profile doesn't exist yet
          console.log(`[OAuth Callback] No profile found for user ${userId}, waiting before retry...`);
          
          if (attempt === maxRetries) {
            return null; // Profile doesn't exist after all retries
          }
          
          // Wait before retry with exponential backoff
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
      
      console.log('[OAuth Callback] Profile fetched successfully:', profile);
      return profile;
    } catch (error) {
      console.error(`[OAuth Callback] Failed to fetch profile (attempt ${attempt}):`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return null;
}

// Enhanced function to refresh session after profile creation
async function refreshSessionAfterProfileCreation(supabase: any, user: any) {
  try {
    console.log('[OAuth Callback] Refreshing session after profile creation...');
    
    // Force a session refresh to ensure the latest data is available
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('[OAuth Callback] Error refreshing session:', error);
      throw error;
    }
    
    console.log('[OAuth Callback] Session refreshed successfully');
    return session;
  } catch (error) {
    console.error('[OAuth Callback] Failed to refresh session:', error);
    // Don't throw here - we can still proceed with the current session
    return null;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';
  const userType = requestUrl.searchParams.get('userType'); // Get userType from URL params
  
  if (code) {
    try {
      const cookieStore = cookies();
      const supabase = await createSupabaseServerClient();
      
      // Exchange the auth code for a session
      const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('[OAuth Callback] Auth code exchange error:', error);
        // Redirect to auth error page with error details
        const errorUrl = new URL('/auth/auth-code-error', requestUrl.origin);
        errorUrl.searchParams.set('error', error.message);
        return NextResponse.redirect(errorUrl);
      }
      
      // Log the successful authentication
      console.log('[OAuth Callback] Authentication successful:', session ? 'Session created' : 'No session created');
      
      // If we have a session, determine the correct dashboard based on user role
      if (session) {
        try {
          // NEW: Add retry logic for profile fetching
          let profile = null;
          let userTypeKey = 'client';
          
          // First, try to fetch existing profile with retry logic
          profile = await fetchUserProfileWithRetry(supabase, session.user.id);
          
          if (profile?.type) {
            // Profile exists, use existing type
            userTypeKey = profile.type.toLowerCase();
            console.log('[OAuth Callback] Found existing profile with type:', userTypeKey);
          } else {
            // No profile found, create new profile
            console.log('[OAuth Callback] No profile found, creating new profile...');
            
            // Create profile for new user with retry logic
            const newProfile = await createUserProfile(supabase, session.user, userType || undefined);
            userTypeKey = newProfile.type.toLowerCase();
            
            // NEW: Wait a moment to ensure profile is properly saved
            console.log('[OAuth Callback] Waiting for profile to be properly saved...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // NEW: Refresh session after profile creation
            await refreshSessionAfterProfileCreation(supabase, session.user);
            
            // NEW: Verify profile was created by fetching it again
            const verifiedProfile = await fetchUserProfileWithRetry(supabase, session.user.id, 2);
            if (verifiedProfile) {
              console.log('[OAuth Callback] Profile creation verified successfully');
            } else {
              console.warn('[OAuth Callback] Profile verification failed, but proceeding with redirect');
            }
          }

          console.log('[OAuth Callback] User role for redirection:', userTypeKey);
          
          // Get the appropriate home route for this user type, fallback to next param
          const homeRoute = USER_HOME_ROUTES[userTypeKey] || next;
          console.log('[OAuth Callback] Redirecting to user dashboard:', homeRoute);
          
          // NEW: Add role to session metadata for faster access
          const response = NextResponse.redirect(new URL(homeRoute, requestUrl.origin));
          
          // Set role in cookie for immediate access
          response.cookies.set('user-role', userTypeKey, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
          });
          
          return response;
        } catch (profileError) {
          console.error('[OAuth Callback] Error in profile lookup/creation:', profileError);
          // Fall back to the provided 'next' parameter
          return NextResponse.redirect(new URL(next, requestUrl.origin));
        }
      }
      
      // Successful auth but no session - redirect to home or requested page
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    } catch (error) {
      console.error('[OAuth Callback] Auth callback error:', error);
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