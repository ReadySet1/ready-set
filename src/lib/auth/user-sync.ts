import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile } from '@prisma/client'
import { UserType, UserStatus } from '@prisma/client'

export interface UserSyncResult {
  profile: Profile | null
  isNewUser: boolean
  error?: string
}

/**
 * Synchronizes Supabase Auth user with local PostgreSQL database
 * Creates local profile if it doesn't exist
 */
export async function syncUserWithDatabase(
  supabaseUser: SupabaseUser
): Promise<UserSyncResult> {
  try {
    // Check if user already exists in local database
    let profile = await prisma.profile.findUnique({
      where: { supabaseId: supabaseUser.id }
    })

    let isNewUser = false

    if (!profile) {
      // Check if profile exists by email (for migration from previous system)
      const existingProfileByEmail = await prisma.profile.findUnique({
        where: { email: supabaseUser.email! }
      })

      if (existingProfileByEmail && !existingProfileByEmail.supabaseId) {
        // Link existing profile to Supabase user
        profile = await prisma.profile.update({
          where: { id: existingProfileByEmail.id },
          data: {
            supabaseId: supabaseUser.id,
            name: supabaseUser.user_metadata?.name || existingProfileByEmail.name,
            image: supabaseUser.user_metadata?.avatar_url || existingProfileByEmail.image
          }
        })
      } else {
        // Create new profile
        profile = await prisma.profile.create({
          data: {
            supabaseId: supabaseUser.id,
            email: supabaseUser.email!,
            name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
            image: supabaseUser.user_metadata?.avatar_url,
            type: determineUserType(supabaseUser),
            status: UserStatus.PENDING // New users start as pending
          }
        })
        isNewUser = true
      }
    } else {
      // Update existing profile with latest Supabase data
      profile = await prisma.profile.update({
        where: { supabaseId: supabaseUser.id },
        data: {
          name: supabaseUser.user_metadata?.name || profile.name,
          image: supabaseUser.user_metadata?.avatar_url || profile.image,
          email: supabaseUser.email! // Ensure email is up to date
        }
      })
    }

    return { profile, isNewUser }
  } catch (error) {
    console.error('User sync error:', error)
    return { 
      profile: null, 
      isNewUser: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Determines user type based on Supabase user metadata
 */
function determineUserType(supabaseUser: SupabaseUser): UserType {
  const metadata = supabaseUser.user_metadata
  
  // Check for admin email domains or explicit role
  if (metadata?.role === 'admin' || supabaseUser.email?.endsWith('@readyset.com')) {
    return UserType.ADMIN
  }
  
  // Check for driver indicators
  if (metadata?.user_type === 'driver' || metadata?.role === 'driver') {
    return UserType.DRIVER
  }
  
  // Check for vendor indicators
  if (metadata?.user_type === 'vendor' || metadata?.business_type) {
    return UserType.VENDOR
  }
  
  // Default to client for new registrations
  return UserType.CLIENT
}

/**
 * Server-side function to get current user with database sync
 */
export async function getCurrentUserServer(): Promise<UserSyncResult> {
  const supabase = createServerComponentClient({ cookies })
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { profile: null, isNewUser: false, error: error?.message }
    }
    
    return await syncUserWithDatabase(user)
  } catch (error) {
    console.error('Server user fetch error:', error)
    return { 
      profile: null, 
      isNewUser: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Type-safe user context
 */
export interface UserContext {
  profile: Profile
  supabaseUser: SupabaseUser
  isNewUser: boolean
}

/**
 * Get full user context (Supabase + Database)
 */
export async function getUserContext(): Promise<UserContext | null> {
  const supabase = createServerComponentClient({ cookies })
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  
  const { profile, isNewUser } = await syncUserWithDatabase(user)
  if (!profile) return null
  
  return {
    profile,
    supabaseUser: user,
    isNewUser
  }
}