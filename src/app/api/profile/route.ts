// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";
import { PrismaTransaction } from "@/types/prisma-types";

export async function GET() {
  try {
    console.log("[Profile API] Starting profile fetch request");
    
    // Initialize Supabase client
    const supabase = await createClient();
    console.log("[Profile API] Supabase client created");
    
    // Get user session from Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log("[Profile API] Auth check result:", {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message
    });
    
    if (!user) {
      console.log("[Profile API] No authenticated user found, returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { 
        status: 401,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    console.log("[Profile API] User authenticated, fetching profile from database");
    
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
    
    console.log("[Profile API] Database query result:", {
      found: !!userData,
      userId: userData?.id,
      userType: userData?.type
    });
    
    if (!userData) {
      console.log("[Profile API] User profile not found in database");
      return NextResponse.json({ error: "User profile not found" }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    console.log("[Profile API] Profile data retrieved successfully");
    
    return NextResponse.json(userData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("[Profile API] Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
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

export async function POST(request: Request) {
  try {
    console.log("[Profile API] Starting profile creation request");
    
    // Parse request body
    const { profileData, userTableData } = await request.json();
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Get user session from Supabase for authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log("[Profile API] POST auth check:", {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message
    });
    
    if (!user) {
      console.log("[Profile API] POST: No authenticated user found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Verify that the user is creating their own profile
    if (user.id !== profileData.auth_user_id) {
      console.log("[Profile API] POST: User trying to create profile for another user");
      return NextResponse.json({ error: "Unauthorized to create profile for another user" }, { status: 403 });
    }

    console.log("[Profile API] Creating profile using server-side operations");
    
    // Begin transaction for all database operations
    const result = await prisma.$transaction(async (tx: PrismaTransaction) => {
      try {
        // 1. Insert profile into Supabase profiles table
        const { data: profileResult, error: profileError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select();
          
        if (profileError) {
          console.error('[Profile API] Profile creation error:', profileError);
          throw new Error(`Profile creation failed: ${profileError.message}`);
        }
        
        console.log("[Profile API] Profile created successfully in Supabase");
        
        // 2. Insert user data into profiles table
        const { data: userTableResult, error: userTableError } = await supabase
          .from('profiles')
          .insert(userTableData)
          .select();
          
        if (userTableError) {
          console.error('[Profile API] User record creation error:', userTableError);
          // Continue anyway since profile was created
        } else {
          console.log("[Profile API] User record created successfully in Supabase");
        }
        
        // 3. Update user metadata with role
        const { error: updateError } = await supabase.auth.updateUser({
          data: { role: userTableData.type },
        });
        
        if (updateError) {
          console.error('[Profile API] Error updating user metadata:', updateError);
          // Continue anyway since critical operations succeeded
        } else {
          console.log("[Profile API] User metadata updated successfully");
        }
        
        return { success: true, profileId: profileData.auth_user_id };
      } catch (txError) {
        console.error("[Profile API] Transaction error:", txError);
        throw txError;
      }
    });
    
    console.log("[Profile API] Profile creation completed successfully");
    
    return NextResponse.json({ 
      success: true, 
      message: 'Profile created successfully',
      data: result
    });
    
  } catch (error) {
    console.error('[Profile API] Error in profile API route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}