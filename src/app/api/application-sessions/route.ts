// src/app/api/application-sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Types
interface CreateSessionRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

interface ApplicationSession {
  id: string;
  session_token: string;
  session_expires_at: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  ip_address?: string;
  user_agent?: string;
  upload_count: number;
  max_uploads: number;
}

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

    // @ts-ignore - application_sessions table will be available after migration
    const { data: recentSessions, error }: any = await (supabase as any)
      .from('application_sessions')
      .select('id')
      .eq('ip_address', ipAddress)
      .gte('created_at', oneHourAgo.toISOString());

    if (error) {
      console.error('Error checking rate limit:', error);
      // Fail open on error (allow the request)
      return { allowed: true };
    }

    if (recentSessions && recentSessions.length >= MAX_SESSIONS_PER_IP_PER_HOUR) {
      return {
        allowed: false,
        message: `Rate limit exceeded. Maximum ${MAX_SESSIONS_PER_IP_PER_HOUR} sessions per hour.`
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open on error
    return { allowed: true };
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

    // Build query
    // @ts-ignore - application_sessions table will be available after migration
    let query: any = (supabase as any)
      .from('application_sessions')
      .select('id, email, first_name, last_name, role, session_expires_at, upload_count, max_uploads, verified, completed');

    if (sessionId) {
      query = query.eq('id', sessionId);
    } else if (sessionToken) {
      query = query.eq('session_token', sessionToken);
    }

    query = query.single();

    const { data: session, error } = await query;

    if (error || !session) {
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
    console.error('Error fetching session:', error);
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
    const body: CreateSessionRequest = await request.json();

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

    // Create session record
    // @ts-ignore - application_sessions table will be available after migration
    const { data: session, error }: any = await (supabase as any)
      .from('application_sessions')
      .insert({
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
        verified: false, // Will be true after email verification
        completed: false
      })
      .select('id, session_token, session_expires_at')
      .single();

    if (error) {
      console.error('Error creating session:', error);
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
    console.error('Error in POST /api/application-sessions:', error);
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
    // @ts-ignore - application_sessions table will be available after migration
    const { data: existingSession, error: fetchError }: any = await (supabase as any)
      .from('application_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('session_token', sessionToken)
      .single();

    if (fetchError || !existingSession) {
      return NextResponse.json(
        { error: 'Invalid session or token' },
        { status: 401 }
      );
    }

    // Update allowed fields only
    const allowedUpdates: Record<string, any> = {};
    if (body.completed !== undefined) allowedUpdates.completed = body.completed;
    if (body.jobApplicationId) allowedUpdates.job_application_id = body.jobApplicationId;

    // @ts-ignore - application_sessions table will be available after migration
    const { data: updatedSession, error: updateError }: any = await (supabase as any)
      .from('application_sessions')
      .update(allowedUpdates)
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating session:', updateError);
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
    console.error('Error in PATCH /api/application-sessions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
