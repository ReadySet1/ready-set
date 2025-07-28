import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    // Get email from query parameters
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    // Verify the current user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 }
      );
    }

    // Get the profile for the specified email
    const profile = await prisma.profile.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        status: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Only allow users to get their own profile or admin/helpdesk users
    if (user.email !== email) {
      // Check if the current user is admin/helpdesk
      const currentUserProfile = await prisma.profile.findUnique({
        where: { email: user.email },
        select: { type: true }
      });

      if (!currentUserProfile || 
          (currentUserProfile.type !== 'ADMIN' && 
           currentUserProfile.type !== 'HELPDESK' && 
           currentUserProfile.type !== 'SUPER_ADMIN')) {
        return NextResponse.json(
          { error: "Unauthorized: Insufficient permissions" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch user profile" },
      { status: 500 }
    );
  }
} 