import { NextRequest, NextResponse } from 'next/server';
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { UserType } from "@/types/prisma";



export async function POST(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    // Check if the user is authenticated
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    
    // Get the current user's details from the database to check type
    const currentUser = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { type: true }
    });

    // Check if the user is a super_admin
    if (currentUser?.type?.toString() !== UserType.SUPER_ADMIN) {
      return NextResponse.json({ message: "Unauthorized - only super admins can change user roles" }, { status: 403 });
    }

    const { userId, newRole } = await request.json();
    
    // Validate that newRole is a valid users_type
    if (!Object.values(UserType).includes(newRole)) {
      return NextResponse.json({ message: 'Invalid role' }, { status: 400 });
    }
    
    // Update in the user table
    const updatedUser = await prisma.profile.update({
      where: { id: String(userId) },
      data: { type: newRole },
    });

    // IMPORTANT: Also update in the profiles table that middleware checks
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update({ type: newRole })
      .eq("auth_user_id", userId);
      
    if (error) {
      console.error("Error updating profile:", error);
      return NextResponse.json({ 
        message: 'User updated but profile update failed', 
        user: updatedUser,
        error: error.message 
      }, { status: 500 });
    }
    
    // Also update user metadata in auth.users if needed
    // This is optional but provides another layer of role information
    const { error: metadataError } = await supabase.auth.admin.updateUserById(
      userId,
      { user_metadata: { role: newRole } }
    );

    if (metadataError) {
      console.error("Error updating user metadata:", metadataError);
    }
    
    return NextResponse.json({ 
      message: 'User role updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ message: 'Error updating user role' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}