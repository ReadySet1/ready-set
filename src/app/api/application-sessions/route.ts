// src/app/api/application-sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { z } from 'zod';
import { logApiError, logDatabaseError } from '@/lib/error-logging';
import type { Database } from '@/types/supabase';

// Type definitions
type ApplicationSession = Database['public']['Tables']['application_sessions']['Row'];
type ApplicationSessionInsert = Database['public']['Tables']['application_sessions']['Insert'];

// Validation schema
const createSessionSchema = z.object({
  email: z.string().email('Invalid email format').max(255, 'Email too long').optional(),
  firstName: z.string().min(1, 'First name required').max(100, 'First name too long').optional(),
  lastName: z.string().min(1, 'Last name required').max(100, 'Last name too long').optional(),
  role: z.string().min(1, 'Role required').max(100, 'Role too long').optional()
});

// Constants
const SESSION_DURATION_HOURS = 2;
const MAX_UPLOADS_PER_SESSION = 10;
const MAX_SESSIONS_PER_IP_PER_HOUR = 5;

/**
 * Rate limiting helper
 */
async function checkRateLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ipAddress: string
): Promise<{ allowed: boolean; message?: string }> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data: recentSessions, error } = await supabase
      .from('application_sessions')
      .select('id')
      .eq('ip_address', ipAddress)
      .gte('created_at', oneHourAgo.toISOString());

    if (error) {
      // Fail closed - reject request if rate limit check fails
      logDatabaseError(error, 'checkRateLimit', { ipAddress });
      return {
        allowed: false,
        message: 'Rate limiting check failed. Please try again later.'
      };
    }

    if (recentSessions && recentSessions.length >= MAX_SESSIONS_PER_IP_PER_HOUR) {
      return {
        allowed: false,
        message: `Rate limit exceeded. Maximum ${MAX_SESSIONS_PER_IP_PER_HOUR} sessions per hour.`
      };
    }

    return { allowed: true };
  } catch (error) {
    // Fail closed on unexpected errors
    logApiError(error, '/api/application-sessions/checkRateLimit', 'GET', { ipAddress });
    return {
      allowed: false,
      message: 'Rate limiting check failed. Please try again later.'
    };
  }
}

/**
 * GET /api/application-sessions/:id
 * Get session details
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    const sessionToken = request.headers.get('x-upload-token');

    if (!sessionId && !sessionToken) {
      return NextResponse.json(
        { error: 'Session ID or token required' },
        { status: 400 }
      );
    }

    // Build query with proper typing
    let query = supabase
      .from('application_sessions')
      .select('id, email, first_name, last_name, role, session_expires_at, upload_count, max_uploads, verified, completed');

    if (sessionId) {
      query = query.eq('id', sessionId);
    } else if (sessionToken) {
      query = query.eq('session_token', sessionToken);
    }

    const { data: session, error } = await query.single<Pick<ApplicationSession,
      'id' | 'email' | 'first_name' | 'last_name' | 'role' | 'session_expires_at' |
      'upload_count' | 'max_uploads' | 'verified' | 'completed'>>();

    // Separate database errors from not-found cases for better debugging
    if (error) {
      logDatabaseError(error, 'getSession', { sessionId, hasToken: !!sessionToken, errorCode: error.code });
      return NextResponse.json(
        { error: 'Database error while fetching session', details: error.message },
        { status: 500 }
      );
    }

    if (!session) {
      // Not a database error - session simply doesn't exist
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if session is expired
    if (new Date(session.session_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        email: session.email,
        firstName: session.first_name,
        lastName: session.last_name,
        role: session.role,
        expiresAt: session.session_expires_at,
        uploadCount: session.upload_count,
        maxUploads: session.max_uploads,
        verified: session.verified,
        completed: session.completed
      }
    });
  } catch (error) {
    logApiError(error, '/api/application-sessions', 'GET', {}, request);
    return NextResponse.json(
      { error: 'Failed to fetch session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/application-sessions
 * Create a new upload session
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Parse and validate request body
    const rawBody = await request.json();
    const validationResult = createSessionSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.issues.map(e => `${String(e.path.join('.'))}:${e.message}`).join(', ')
        },
        { status: 400 }
      );
    }

    const body = validationResult.data;

    // Extract client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(supabase, ipAddress);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: rateLimitResult.message },
        { status: 429 }
      );
    }

    // Generate session token (secure random string)
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Calculate expiration
    const sessionExpiresAt = new Date(
      Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000
    );

    // Create session record with proper typing
    const sessionData: ApplicationSessionInsert = {
      email: body.email,
      first_name: body.firstName,
      last_name: body.lastName,
      role: body.role,
      session_token: sessionToken,
      session_expires_at: sessionExpiresAt.toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
      upload_count: 0,
      max_uploads: MAX_UPLOADS_PER_SESSION,
      verified: false,
      completed: false
    };

    const { data: session, error } = await supabase
      .from('application_sessions')
      .insert(sessionData)
      .select('id, session_token, session_expires_at')
      .single<Pick<ApplicationSession, 'id' | 'session_token' | 'session_expires_at'>>();

    if (error) {
      logDatabaseError(error, 'createSession', { email: body.email, role: body.role });
      return NextResponse.json(
        { error: 'Failed to create session', details: error.message },
        { status: 500 }
      );
    }

    // For now, return the session token directly
    // In phase 2, we'll send a verification email and return session ID only
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      uploadToken: session.session_token,
      expiresAt: session.session_expires_at,
      message: 'Session created successfully. You can now upload files.'
    }, { status: 201 });
  } catch (error) {
    logApiError(error, '/api/application-sessions', 'POST', {}, request);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/application-sessions/:id
 * Update session (mark as completed, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');
    const sessionToken = request.headers.get('x-upload-token');

    if (!sessionId || !sessionToken) {
      return NextResponse.json(
        { error: 'Session ID and token required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate session ownership
    const { data: existingSession, error: fetchError } = await supabase
      .from('application_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('session_token', sessionToken)
      .single();

    if (fetchError || !existingSession) {
      logDatabaseError(fetchError || new Error('Session not found'), 'validateSession', { sessionId });
      return NextResponse.json(
        { error: 'Invalid session or token' },
        { status: 401 }
      );
    }

    // Update allowed fields only
    const allowedUpdates: Partial<ApplicationSession> = {};
    if (body.completed !== undefined) allowedUpdates.completed = body.completed;
    if (body.jobApplicationId) allowedUpdates.job_application_id = body.jobApplicationId;

    const { data: updatedSession, error: updateError } = await supabase
      .from('application_sessions')
      .update(allowedUpdates)
      .eq('id', sessionId)
      .select()
      .single<ApplicationSession>();

    if (updateError) {
      logDatabaseError(updateError, 'updateSession', { sessionId });
      return NextResponse.json(
        { error: 'Failed to update session', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: updatedSession
    });
  } catch (error) {
    logApiError(error, '/api/application-sessions', 'PATCH', {}, request);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
