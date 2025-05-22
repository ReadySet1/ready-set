'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User, Session } from '@supabase/supabase-js'

interface UseAuthReturn {
  user: User | null
  session: Session | null
  loading: boolean
  error: Error | null
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event)
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    // Check for existing session
    const initSession = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Session error in useAuth:', error);
          throw error
        }
        
        if (data.session) {
          console.log('Session loaded successfully in useAuth hook');
          setSession(data.session)
          setUser(data.session?.user ?? null)
        } else {
          console.log('No session found in useAuth hook');
          // Try to recover the session
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Session refresh error:', refreshError);
          } else if (refreshData.session) {
            console.log('Session refreshed successfully');
            setSession(refreshData.session);
            setUser(refreshData.session.user);
          }
        }
      } catch (e) {
        console.error('Error getting session:', e)
        setError(e instanceof Error ? e : new Error('Unknown error'))
      } finally {
        setLoading(false)
      }
    }

    initSession()

    // Cleanup subscription
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/sign-in')
    } catch (e) {
      console.error('Error signing out:', e)
      setError(e instanceof Error ? e : new Error('Error signing out'))
    } finally {
      setLoading(false)
    }
  }

  return { user, session, loading, error, signOut }
} 