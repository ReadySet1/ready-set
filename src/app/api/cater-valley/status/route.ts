/**
 * CaterValley Integration Status Endpoint
 * Provides information about the integration status and available endpoints.
 *
 * The public response intentionally does NOT advertise environment
 * configuration (whether API keys or webhook URLs are set) — that signal
 * helped attackers fingerprint a deployment. Operators who need that
 * detail should query application logs or Sentry instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check database connectivity. Soft-deleted orders are excluded so the
    // public count reflects active CaterValley traffic.
    let dbStatus = 'connected';
    let orderCount = 0;
    try {
      orderCount = await prisma.cateringRequest.count({
        where: {
          orderNumber: {
            startsWith: 'CV-',
          },
          deletedAt: null,
        },
      });
    } catch (error) {
      dbStatus = 'error';
      console.error('Database connectivity check failed:', error);
    }

    const status = {
      service: 'Ready Set CaterValley Integration',
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        status: dbStatus,
        caterValleyOrderCount: orderCount,
      },
      endpoints: {
        draft: {
          method: 'POST',
          path: '/api/cater-valley/orders/draft',
          description: 'Create a new draft order with pricing calculation',
          authentication: 'Required: partner + x-api-key headers',
        },
        update: {
          method: 'POST',
          path: '/api/cater-valley/orders/update',
          description: 'Update an existing draft order and recalculate pricing',
          authentication: 'Required: partner + x-api-key headers',
        },
        confirm: {
          method: 'POST',
          path: '/api/cater-valley/orders/confirm',
          description: 'Confirm or cancel an order',
          authentication: 'Required: partner + x-api-key headers',
        },
        webhook: {
          method: 'POST',
          description:
            'Ready Set sends status updates to CaterValley (HMAC-signed when configured)',
        },
      },
      statusMapping: {
        'ASSIGNED': 'CONFIRM',
        'ARRIVED_AT_VENDOR': 'READY',
        'EN_ROUTE_TO_CLIENT': 'ON_THE_WAY',
        'ARRIVED_TO_CLIENT': 'ON_THE_WAY',
        'COMPLETED': 'COMPLETED',
        'CANCELLED': 'CANCELLED',
      },
      pricing: {
        structure: 'Distance-based with head count tiers',
        distanceTiers: {
          standard: '0-10 miles',
          over10: 'Over 10 miles',
          over30: 'Over 30 miles'
        },
        headCountTiers: {
          tier1: '>25 headcount or >$300 food cost',
          tier2: '25-49 headcount or $300-$599 food cost', 
          tier3: '50-74 headcount or $600-$899 food cost',
          tier4: '75-99 headcount or $900-$1199 food cost',
          tier5: '100+ headcount or $1200+ food cost (percentage-based)'
        },
        tipOptions: 'Pricing available with tip (default) or without tip',
        percentagePricing: '9% with tip, 10% without tip for 100+ headcount',
        distanceCalculation: 'Google Maps API integration for accurate distance'
      },
      businessHours: {
        deliveryWindow: '7:00 AM - 10:00 PM',
        minimumAdvanceTime: '2 hours',
        timezone: 'Local time',
      },
      contact: {
        technical: 'developer@readyset.com',
        support: 'support@readyset.com',
      },
    };

    return NextResponse.json(status, { status: 200 });

  } catch (error) {
    console.error('Error in CaterValley status endpoint:', error);
    
    return NextResponse.json({
      service: 'Ready Set CaterValley Integration',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
      message: 'Unable to retrieve status information',
    }, { status: 500 });
  }
}

// Also support POST for testing purposes
export async function POST(request: NextRequest) {
  const headers = Object.fromEntries(request.headers.entries());
  
  let body = null;
  try {
    body = await request.json();
  } catch (error) {
    // Ignore parsing errors for status endpoint
  }

        
  // Return the same status information as GET
  return GET(request);
} 