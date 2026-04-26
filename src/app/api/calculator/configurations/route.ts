/**
 * API Route: Calculator Configurations
 * Handles CRUD operations for client delivery configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import {
  ClientDeliveryConfiguration,
  validateConfiguration,
  getActiveConfigurations,
  getConfiguration
} from '@/lib/calculator/client-configurations';
import type { SupabaseClient } from '@supabase/supabase-js';

// Calculator pricing changes affect every order — gate writes to admin roles
// only. Middleware excludes /api routes, so this check has to live in-route.
async function authorizeCalculatorAdmin(
  supabase: SupabaseClient,
): Promise<
  | { authorized: true; userId: string; userEmail: string | undefined }
  | { authorized: false; status: 401 | 403 }
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, status: 401 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', user.id)
    .maybeSingle();

  const userType = (profile?.type ?? '').toLowerCase();
  if (!['admin', 'super_admin'].includes(userType)) {
    return { authorized: false, status: 403 };
  }

  return { authorized: true, userId: user.id, userEmail: user.email };
}

// Helper function to convert DB record to ClientDeliveryConfiguration.
// Reads zeroOrderSettings from the dedicated column first; falls back to the
// nested customSettings location (written by an earlier revision of this PR)
// and finally to the in-memory default. Keeping the legacy nested read lets us
// recover any rows that were written during the buggy window without a backfill.
function dbToConfig(dbConfig: any): ClientDeliveryConfiguration {
  const inMemoryConfig = getConfiguration(dbConfig.configId);
  const customSettings = dbConfig.customSettings as Record<string, any> | null;
  const zeroOrderSettings =
    dbConfig.zeroOrderSettings ??
    customSettings?.zeroOrderSettings ??
    inMemoryConfig?.zeroOrderSettings;

  // Strip zeroOrderSettings out of customSettings so we don't echo it back as
  // a nested duplicate after a read.
  const { zeroOrderSettings: _stripped, ...restCustomSettings } =
    customSettings ?? {};

  return {
    id: dbConfig.configId,
    clientName: dbConfig.clientName,
    vendorName: dbConfig.vendorName,
    description: dbConfig.description || undefined,
    isActive: dbConfig.isActive,
    pricingTiers: dbConfig.pricingTiers as any,
    mileageRate: parseFloat(dbConfig.mileageRate.toString()),
    distanceThreshold: parseFloat(dbConfig.distanceThreshold.toString()),
    dailyDriveDiscounts: dbConfig.dailyDriveDiscounts as any,
    driverPaySettings: dbConfig.driverPaySettings as any,
    bridgeTollSettings: dbConfig.bridgeTollSettings as any,
    zeroOrderSettings,
    customSettings:
      Object.keys(restCustomSettings).length > 0
        ? (restCustomSettings as any)
        : undefined,
    createdAt: dbConfig.createdAt,
    updatedAt: dbConfig.updatedAt,
    createdBy: dbConfig.createdBy || undefined,
    notes: dbConfig.notes || undefined
  };
}

// Helper function to convert ClientDeliveryConfiguration to DB format.
// zeroOrderSettings goes back into its dedicated Prisma column; customSettings
// stays a separate JSON bag for genuinely custom future fields.
function configToDb(config: ClientDeliveryConfiguration, userId?: string) {
  return {
    configId: config.id,
    clientName: config.clientName,
    vendorName: config.vendorName,
    description: config.description ?? null,
    isActive: config.isActive,
    pricingTiers: config.pricingTiers as any,
    mileageRate: config.mileageRate,
    distanceThreshold: config.distanceThreshold,
    dailyDriveDiscounts: config.dailyDriveDiscounts as any,
    driverPaySettings: config.driverPaySettings as any,
    bridgeTollSettings: config.bridgeTollSettings as any,
    zeroOrderSettings: (config.zeroOrderSettings as any) ?? null,
    customSettings: (config.customSettings as any) ?? null,
    createdBy: userId ?? null,
    notes: config.notes ?? null,
    updatedAt: new Date()
  };
}

// GET: Fetch all configurations or a specific one (public — no auth required)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (configId) {
      try {
        // Try to fetch from database first
        const dbConfig = await prisma.deliveryConfiguration.findUnique({
          where: { configId, isActive: true }
        });

        if (dbConfig) {
          const response = NextResponse.json({ success: true, data: dbToConfig(dbConfig), source: 'database' });
          response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
          return response;
        }
      } catch (dbError) {
        Sentry.captureException(dbError, {
          tags: { operation: 'calculator-configurations-get-single' },
          level: 'warning',
        });
        console.warn('Database query failed, falling back to in-memory configs:', dbError);
      }

      // Fallback to in-memory configurations
      const config = getConfiguration(configId);
      if (!config) {
        return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
      }
      const singleInMemoryResponse = NextResponse.json({ success: true, data: config, source: 'in-memory' });
      singleInMemoryResponse.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      return singleInMemoryResponse;
    } else {
      try {
        // Try to fetch all from database
        const dbConfigs = await prisma.deliveryConfiguration.findMany({
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        });

        // If DB has configs, return them
        if (dbConfigs.length > 0) {
          const configurations = dbConfigs.map(dbToConfig);
          const dbListResponse = NextResponse.json({ success: true, data: configurations, source: 'database' });
          dbListResponse.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
          return dbListResponse;
        }
      } catch (dbError) {
        Sentry.captureException(dbError, {
          tags: { operation: 'calculator-configurations-get-all' },
          level: 'warning',
        });
        console.warn('Database query failed, falling back to in-memory configs:', dbError);
      }

      // Fallback to in-memory defaults
      const configurations = getActiveConfigurations();
      const inMemoryListResponse = NextResponse.json({ success: true, data: configurations, source: 'in-memory' });
      inMemoryListResponse.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      return inMemoryListResponse;
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'calculator-configurations-get' },
    });
    console.error('Error fetching configurations:', error);
    // Even on error, try to return in-memory defaults
    try {
      const configurations = getActiveConfigurations();
      return NextResponse.json({ success: true, data: configurations });
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Failed to fetch configurations' },
        { status: 500 }
      );
    }
  }
}

// POST: Create/Update configuration (admin/super_admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await authorizeCalculatorAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const config: ClientDeliveryConfiguration = body;

    // Validate configuration
    const validation = validateConfiguration(config);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: validation.errors },
        { status: 400 }
      );
    }

    // Save to database
    const dbData = configToDb(config, auth.userId);

    const savedConfig = await prisma.deliveryConfiguration.upsert({
      where: { configId: config.id },
      update: dbData,
      create: dbData
    });

    return NextResponse.json({
      success: true,
      data: dbToConfig(savedConfig),
      message: 'Configuration saved successfully'
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'calculator-configurations-post' },
    });
    console.error('Error saving configuration:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

// DELETE: Soft-delete a configuration (admin/super_admin only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await authorizeCalculatorAdmin(supabase);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.status === 401 ? 'Unauthorized' : 'Forbidden' },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (!configId) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    await prisma.deliveryConfiguration.update({
      where: { configId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully'
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'calculator-configurations-delete' },
    });
    console.error('Error deleting configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    );
  }
}
