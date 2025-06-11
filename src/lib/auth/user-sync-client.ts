import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile, UserType, UserStatus } from '@prisma/client'

export interface UserSyncResult {
  profile: Profile | null
  isNewUser: boolean
  error?: string
}

/**
 * Client-side function to get current user with database sync
 */
export async function getCurrentUserClient(): Promise<UserSyncResult> {
  const supabase = createClientComponentClient()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { profile: null, isNewUser: false, error: error?.message }
    }
    
    // For client-side, we need to call an API route to sync with database
    const response = await fetch('/api/auth/sync-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user })
    })
    
    if (!response.ok) {
      throw new Error('Failed to sync user')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Client user fetch error:', error)
    return { 
      profile: null, 
      isNewUser: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
} 