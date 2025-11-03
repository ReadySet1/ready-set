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

import { NextResponse } from 'next/server';
import { captureException, captureMessage } from '@/lib/monitoring/sentry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
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
            deliveryId: 'test-123',
            driverId: 'test-driver-456',
            testType: 'context',
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
    // Let the error propagate to Sentry's automatic error capture
    throw error;
  }
}
