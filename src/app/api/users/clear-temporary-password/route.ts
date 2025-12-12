// src/app/api/users/clear-temporary-password/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * POST /api/users/clear-temporary-password
 *
 * Clears the isTemporaryPassword flag for the authenticated user.
 * This endpoint should be called after a successful password change
 * to mark that the user has set their own password.
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Update the user's profile to clear the temporary password flag
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        isTemporaryPassword: false,
        updatedAt: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error clearing temporary password flag:", updateError);
      return NextResponse.json(
        { error: "Failed to update password status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in clear-temporary-password:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
