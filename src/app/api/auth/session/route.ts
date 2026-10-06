import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { getDriverForUser } from '@/lib/auth/driver-ownership';

/**
 * Session endpoint - returns current user session with profile and driver info
 * Used by location simulator and other client-side code that needs session data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      // Return empty session for unauthenticated requests
      return NextResponse.json({ user: null, expires: null });
    }

    // Fetch profile data
    const profile = await prisma.$queryRawUnsafe<{
      id: string;
      email: string;
      name: string;
      type: string;
    }[]>(`
      SELECT id, email, name, type
      FROM profiles
      WHERE id = $1::uuid
      LIMIT 1
    `, user.id);

    const userProfile = profile[0];
    const userType = userProfile?.type || 'VENDOR';

    // If user is a DRIVER, fetch their driver table ID
    let driverId: string | null = null;

    if (userType === 'DRIVER') {
      // Ownership lookup lives in driver-ownership: it accepts the canonical
      // profile_id and the legacy user_id link, and skips deleted rows.
      const driver = await getDriverForUser(user.id);
      driverId = driver?.id ?? null;
    }

    const session = {
      user: {
        id: user.id,
        email: user.email || userProfile?.email,
        type: userType,
        driverId,
        name: userProfile?.name || user.email?.split('@')[0] || 'User'
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    return NextResponse.json(session);
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}