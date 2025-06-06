// src/lib/auth.ts
import { createClient } from "@/utils/supabase/server";
import { UserType } from "@/types/user";
// Note: If UserType enum from Prisma is available/generated for frontend/server code,
// you could import and use it for stronger type safety, e.g.:
//  // Adjust import path as needed

export async function syncOAuthProfile(userId: string, metadata: any) {
  // This function can be called after OAuth authentication to check if a profile needs to be created
  const supabase = await createClient();

  // Check if profile already exists using the correct ID field
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId) // Changed: Use 'id' instead of 'auth_user_id'
    .single();

  if (existingProfile) {
    // Profile already exists, no need to create
    return { success: true, newProfile: false, profile: existingProfile };
  }

  // Get user data which might contain the email
  const { data: authUserData } = await supabase.auth.getUser();

  // Check for OAuth provider information
  const providerData = authUserData?.user?.app_metadata?.provider;
  if (!providerData) {
    // Not an OAuth user (or provider info missing), let them complete profile manually
    // Or handle differently if email signup also uses this flow initially
    console.warn("syncOAuthProfile called for non-OAuth user or missing provider data, userId:", userId);
    return { success: false, newProfile: false, message: "Not identified as OAuth user for automatic profile creation." };
  }

  // --- Prepare data for new profile ---

  // Changed: Prioritize email from auth user, fall back to metadata
  const userEmail = authUserData?.user?.email || metadata?.email;
  if (!userEmail) {
      console.error("Could not determine user email for profile creation. Auth Data:", authUserData, "Metadata:", metadata);
      return { success: false, newProfile: false, message: "Email not available from provider or metadata." };
  }

  const userName = metadata?.full_name || metadata?.name || userEmail.split('@')[0]; // Fallback name
  const userImage = metadata?.avatar_url || metadata?.picture;

  // --- Create the profile ---
  // For OAuth users, auto-create a basic profile.
  console.log(`Attempting to create profile for user ID: ${userId}`);
  const { error } = await supabase.from("profiles").insert({
    id: userId,               // Changed: Use 'id' as the primary key matching the Supabase Auth ID
    email: userEmail,         // Changed: Added email field
    name: userName,
    image: userImage,
    type: "CLIENT",           // Changed: Match enum case 'CLIENT'
    status: "PENDING",        // Changed: Match enum case 'PENDING'
    // Add default values for other *required* fields from your Prisma schema if necessary
    // e.g., companyName: null, contactName: null, etc. if they are NOT NULL without defaults
  });

  if (error) {
    console.error("Error creating profile:", error);
    // Check for specific errors, e.g., unique constraint violation on email if user signed up differently before
    if (error.code === '23505') { // PostgreSQL unique violation code
        return { success: false, error, message: "A profile with this email might already exist." };
    }
    return { success: false, error };
  }

  console.log(`Successfully created profile for user ID: ${userId}`);
  // Fetch the newly created profile to return it (optional but good practice)
   const { data: newProfileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return { success: true, newProfile: true, profile: newProfileData };
}

// IMPORTANT: Ensure the 'role' string passed here matches the UserType enum case (e.g., "VENDOR", "CLIENT")
export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient();
  let profileError: any = null;
  let authError: any = null;

  // Changed: Update the 'type' field in the 'profiles' table first
  console.log(`Updating profile type for user ${userId} to ${role}`);
  const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ type: role }) // Use the role value directly (ensure correct case)
      .eq("id", userId);     // Changed: Use 'id' instead of 'auth_user_id'

  if (updateProfileError) {
      console.error("Error updating profile type:", updateProfileError);
      profileError = updateProfileError;
      // Depending on requirements, you might want to stop here
      // return { success: false, error: profileError, message: "Failed to update profile type." };
  } else {
      console.log(`Successfully updated profile type for user ${userId}`);
  }

  // Changed: Also update user metadata in Auth (can be redundant or serve other purposes)
  // Useful if other parts of the system rely solely on auth metadata.
  console.log(`Updating auth metadata role for user ${userId} to ${role}`);
  const { error: updateAuthError } = await supabase.auth.updateUser({
      // Note: Supabase admin actions might be needed for this if RLS restricts user self-updating metadata
      data: { role: role }, // Keep metadata in sync
  });

  if (updateAuthError) {
      console.error("Error updating auth metadata role:", updateAuthError);
      authError = updateAuthError;
  } else {
     console.log(`Successfully updated auth metadata role for user ${userId}`);
  }

  // Return success only if the primary update (profile) succeeded.
  // Adjust error reporting based on which update is considered critical.
  if (profileError) {
      return { success: false, error: profileError || authError, message: "Failed to update user role in profile." };
  }
  if(authError) {
      // Log the auth error but potentially return success if profile update worked
       console.warn(`Profile type updated, but failed to update auth metadata role for user ${userId}:`, authError);
  }


  return { success: true };
}

export async function getUserRole(userId: string): Promise<string | null> {
  const supabase = await createClient();

  // First check in profiles table using the correct ID field
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("type")
    .eq("id", userId) // Changed: Use 'id' instead of 'auth_user_id'
    .single();

  if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = Row not found, which is okay here
      console.error("Error fetching profile type:", profileError);
      // Decide how to handle DB errors - maybe throw or return null
  }

  if (profile?.type) {
    return profile.type; // Return role from profile if it exists
  }

  // If not found in profiles (or profile.type is null), check user metadata as a fallback
  console.warn(`Role not found in profile for user ${userId}, checking auth metadata as fallback.`);
  const { data: authData, error: authError } = await supabase.auth.getUser();

   if (authError) {
      console.error("Error fetching auth user data for role:", authError);
      return null; // Return null if auth data fetch fails
   }
   // Explicitly check user_metadata exists before accessing role
   const roleFromMetadata = authData?.user?.user_metadata?.role;
   if (roleFromMetadata) {
       console.log(`Role found in auth metadata for user ${userId}: ${roleFromMetadata}`);
       return roleFromMetadata;
   }

  console.log(`Role not found in profile or auth metadata for user ${userId}.`);
  return null; // Return null if role is not found in either location
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}