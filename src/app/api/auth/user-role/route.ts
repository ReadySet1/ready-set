import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { UserType } from "@/types/prisma";

// Helper function to check if user has admin privileges
function hasAdminPrivileges(userType: string): boolean {
  // Handle both lowercase and uppercase user types
  const normalizedType = userType?.toUpperCase();
  return normalizedType === 'ADMIN' || normalizedType === 'SUPER_ADMIN' || normalizedType === 'HELPDESK';
}

export async function GET(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { 
          isAdmin: false, 
          isSuperAdmin: false,
          error: "Unauthorized - Invalid authorization header" 
        },
        { status: 401 }
      );
    }

    // Extract the token from header
    const token = authHeader.split(' ')[1];
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Verify the token by passing it to getUser
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { 
          isAdmin: false, 
          isSuperAdmin: false,
          error: "Unauthorized - Invalid JWT token" 
        }, 
        { status: 401 }
      );
    }

    // Retrieve user's profile from the database
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true }
    });

    if (!profile) {
      return NextResponse.json(
        { 
          isAdmin: false, 
          isSuperAdmin: false,
          error: "User profile not found"
        }, 
        { status: 404 }
      );
    }

    // Determine user roles using normalized type comparison
    const normalizedType = profile.type?.toUpperCase();
    const isAdmin = normalizedType === 'ADMIN';
    const isSuperAdmin = normalizedType === 'SUPER_ADMIN';
    const isHelpdesk = normalizedType === 'HELPDESK';

    // Return role information
    return NextResponse.json({
      isAdmin,
      isSuperAdmin,
      isHelpdesk,
      userType: profile.type
    }, { status: 200 });

  } catch (error) {
    console.error("Error checking user role:", error);
    
    return NextResponse.json(
      { 
        isAdmin: false, 
        isSuperAdmin: false,
        error: "Internal server error"
      }, 
      { status: 500 }
    );
  }
} 