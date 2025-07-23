// DIAGNOSTIC: Enhanced profile API route with better logging
import { NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    console.log('[Profile Debug API] Starting authentication check...');
    
    // Initialize Supabase client
    const supabase = await createClient();
    console.log('[Profile Debug API] Supabase client created');
    
    // Get user session from Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('[Profile Debug API] Auth check result:', { 
      hasUser: !!user, 
      userId: user?.id, 
      authError: authError?.message 
    });
    
    if (!user || authError) {
      console.log('[Profile Debug API] Authentication failed, returning 401');
      return NextResponse.json({ 
        error: "Unauthorized",
        debug: {
          hasUser: !!user,
          authError: authError?.message || null,
          timestamp: new Date().toISOString()
        }
      }, { 
        status: 401,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    console.log('[Profile Debug API] User authenticated, fetching profile...');
    
    // Get the user's profile from your database
    const userData = await prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        type: true,
        email: true,
        name: true,
        contactName: true,
        contactNumber: true,
        companyName: true,
        image: true,
        status: true,
        // Address fields
        street1: true,
        street2: true,
        city: true,
        state: true,
        zip: true
      }
    });    
    console.log('[Profile Debug API] Database query result:', { 
      hasUserData: !!userData,
      userId: userData?.id
    });
    
    if (!userData) {
      console.log('[Profile Debug API] User profile not found in database');
      return NextResponse.json({ 
        error: "User profile not found",
        debug: {
          userId: user.id,
          searchedInDatabase: true,
          timestamp: new Date().toISOString()
        }
      }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    console.log('[Profile Debug API] Successfully returning user data');
    return NextResponse.json({
      success: true,
      profile: userData,
      debug: {
        timestamp: new Date().toISOString(),
        userId: user.id,
        profileFound: true
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("[Profile Debug API] Error fetching user profile:", error);
    return NextResponse.json(
      { 
        error: "Internal Server Error",
        debug: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : null,
          timestamp: new Date().toISOString()
        }
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      },
    );
  }
}