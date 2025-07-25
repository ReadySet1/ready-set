// src/app/api/users/updateUserStatus/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";
import { UserStatus, UserType } from '@/types/prisma';

export async function PUT(request: Request) {
  try {
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Get user session from Supabase
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user's role from your database
    let userData;
    
    try {
      // First try profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('type')
        .eq('auth_user_id', user.id)
        .single();
      
      if (profile) {
        userData = { type: profile.type };
      } else {
        // Fall back to prisma if not in profiles
        userData = await prisma.profile.findUnique({
          where: { id: user.id },
          select: { type: true }
        });
      }
    } catch (err) {
      console.error("Error fetching user role:", err);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

    // Check if user has appropriate permissions (super_admin, helpdesk, or admin)
    if (
      userData?.type !== UserType.SUPER_ADMIN && 
      userData?.type !== UserType.HELPDESK && 
      userData?.type !== UserType.ADMIN
    ) {
      return NextResponse.json({ 
        error: "Forbidden. Only admins, helpdesk, and super admin users can update user status."
      }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { userId, newStatus } = body;

    if (!userId || !newStatus) {
      return NextResponse.json({
        error: "Missing required fields",
        details: { userId, newStatus }
      }, { status: 400 });
    }

    // Validate the status
    const validStatuses = ["active", "pending", "deleted"];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({
        error: "Invalid status. Must be one of: active, pending, deleted",
        details: { providedStatus: newStatus }
      }, { status: 400 });
    }

    console.log(`Attempting to update user ${userId} status to ${newStatus}`);
    
    // Convert lowercase status string to uppercase enum value
    const statusEnum = newStatus.toUpperCase() as UserStatus;

    // Validate the converted enum value (optional but good practice)
    if (!Object.values(UserStatus).includes(statusEnum)) {
       return NextResponse.json({
         error: `Invalid status value after conversion: ${statusEnum}`,
         details: { providedStatus: newStatus }
       }, { status: 400 });
    }

    // Update user status in database using the enum value
    const updatedUser = await prisma.profile.update({
      where: { id: userId },
      data: { status: statusEnum },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        status: true,
      }
    });

    console.log("User status updated successfully:", updatedUser);

    return NextResponse.json({
      message: "User status updated successfully",
      user: updatedUser
    });
  } catch (error: any) {
    console.error("Error updating user status:", error);
    
    // Handle common errors with descriptive messages
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        error: "User not found" 
      }, { status: 404 });
    }
    
    return NextResponse.json({
      error: "Failed to update user status",
      details: error.message
    }, { status: 500 });
  }
}