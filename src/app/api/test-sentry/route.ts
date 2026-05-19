/**
 * Sentry Test API Route
 *
 * This endpoint is used to test Sentry error tracking.
 * It throws intentional errors to verify that Sentry is capturing them correctly.
 *
 * @route GET /api/test-sentry
 *
 * Usage:
 * - Development: http://localhost:3000/api/test-sentry
 * - Should only be used in development/staging environments
 *
 * IMPORTANT: This endpoint should be protected or removed in production
 */

import { NextRequest, NextResponse } from 'next/server';
import { captureException, captureMessage } from '@/lib/monitoring/sentry';
import { withAuth } from '@/lib/auth-middleware';
import { devOnlyGuard } from '@/lib/auth/dev-only-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const blocked = devOnlyGuard();
  if (blocked) return blocked;

  const authResult = await withAuth(request, {
    allowedRoles: ['SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!authResult.success || authResult.response) {
    return (
      authResult.response ??
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
  }

  // Parse query parameters to determine test type
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('type') || 'error';

  try {
    switch (testType) {
      case 'error':
        // Test exception capture
        throw new Error('Sentry Test Error - This is intentional for testing');

      case 'message':
        // Test message capture
        captureMessage(
          'Sentry Test Message - Verifying message capture',
          'info',
          {
            testType: 'message',
            timestamp: new Date().toISOString(),
          }
        );
        return NextResponse.json({
          success: true,
          message: 'Test message sent to Sentry',
          type: 'message',
        });

      case 'warning':
        // Test warning message
        captureMessage(
          'Sentry Test Warning - Verifying warning capture',
          'warning',
          {
            testType: 'warning',
            timestamp: new Date().toISOString(),
          }
        );
        return NextResponse.json({
          success: true,
          message: 'Test warning sent to Sentry',
          type: 'warning',
        });

      case 'context':
        // Test exception with context
        try {
          throw new Error('Test error with context');
        } catch (error) {
          captureException(error, {
            feature: 'delivery_tracking',
            metadata: {
              deliveryId: 'test-123',
              driverId: 'test-driver-456',
              testType: 'context',
            },
          });
        }
        return NextResponse.json({
          success: true,
          message: 'Test error with context sent to Sentry',
          type: 'context',
        });

      default:
        return NextResponse.json({
          error: 'Invalid test type',
          validTypes: ['error', 'message', 'warning', 'context'],
        });
    }
  } catch (error) {
    // Capture in Sentry for tracking
    captureException(error, {
      feature: 'test-sentry',
      action: 'test-endpoint-error',
    });

    // Return controlled error response to avoid leaking stack traces
    return NextResponse.json(
      {
        success: false,
        error: 'Test error triggered',
        message: 'Check Sentry dashboard for details',
      },
      { status: 500 }
    );
  }
}
