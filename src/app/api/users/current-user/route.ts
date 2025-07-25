// src/app/api/users/current-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { UserType } from "@/types/prisma";


export async function GET(request: Request) {
  // Add request tracking for debugging
  const requestId = Math.random().toString(36).substring(7);
  const url = new URL(request.url);

  try {
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Get user session from Supabase
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log(`[${requestId}] No authenticated user found`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try to get user from the profiles table in Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      console.log(`[${requestId}] Found user in profiles table:`, profile);
      
      // Return the user info directly from Supabase
      // Ensure ID is correct by spreading profile first, then overriding with auth user data
      return NextResponse.json({
        ...profile,
        id: user.id, // Auth user ID takes precedence
        email: user.email || profile.email // Use auth email if available
      });
    }
    
    // If we still can't find a role, check user metadata
    if (user.user_metadata && (user.user_metadata.type || user.user_metadata.role)) {
      console.log(`[${requestId}] Using role from user metadata:`, user.user_metadata);
      
      // Return the user with metadata info
      return NextResponse.json({
        id: user.id,
        email: user.email,
        type: user.user_metadata.type || user.user_metadata.role || UserType.CLIENT
      });
    }

    // If we got here, we couldn't determine the user's role
    console.log(`[${requestId}] User profile not found for ID: ${user.id}`);
    return NextResponse.json({ 
      error: "User profile data not found in any source.",
      details: `Checked profiles table and user metadata for user ID ${user.id}.`,
      id: user.id,
      email: user.email,
      type: UserType.CLIENT
    }, { status: 404 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${requestId}] Error fetching current user:`, error);
    return NextResponse.json(
      { 
        error: "Internal Server Error fetching current user",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}