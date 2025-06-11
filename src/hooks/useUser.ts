import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile } from '@prisma/client'
import { getCurrentUserClient, type UserSyncResult } from '@/lib/auth/user-sync-client'

export interface UseUserReturn {
  profile: Profile | null
  supabaseUser: SupabaseUser | null
  isLoading: boolean
  isNewUser: boolean
  error: string | null
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

/**
 * React hook for user authentication and profile management
 * Handles both Supabase Auth and local database synchronization
 */
export function useUser(): UseUserReturn {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isNewUser, setIsNewUser] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClientComponentClient()

  const fetchUser = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Get Supabase user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        setError(authError.message)
        return
      }
      
      setSupabaseUser(user)
      
      if (user) {
        // Sync with local database
        const syncResult = await getCurrentUserClient()
        
        if (syncResult.error) {
          setError(syncResult.error)
        } else {
          setProfile(syncResult.profile)
          setIsNewUser(syncResult.isNewUser)
        }
      } else {
        setProfile(null)
        setIsNewUser(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setIsLoading(true)
      await supabase.auth.signOut()
      setProfile(null)
      setSupabaseUser(null)
      setIsNewUser(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshUser = async () => {
    await fetchUser()
  }

  useEffect(() => {
    fetchUser()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await fetchUser()
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
          setSupabaseUser(null)
          setIsNewUser(false)
          setError(null)
          setIsLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return {
    profile,
    supabaseUser,
    isLoading,
    isNewUser,
    error,
    signOut,
    refreshUser
  }
}