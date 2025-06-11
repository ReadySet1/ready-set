import { NextRequest, NextResponse } from 'next/server'
import { syncUserWithDatabase } from '@/lib/auth/user-sync'
import type { User as SupabaseUser } from '@supabase/supabase-js'

/**
 * API Route for client-side user synchronization
 * POST /api/auth/sync-user
 */
export async function POST(request: NextRequest) {
  try {
    const { user }: { user: SupabaseUser } = await request.json()
    
    if (!user || !user.id || !user.email) {
      return NextResponse.json(
        { error: 'Invalid user data provided' },
        { status: 400 }
      )
    }
    
    const result = await syncUserWithDatabase(user)
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('User sync API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}