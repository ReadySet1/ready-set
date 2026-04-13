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

// Helper function to convert DB record to ClientDeliveryConfiguration
function dbToConfig(dbConfig: any): ClientDeliveryConfiguration {
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
    zeroOrderSettings: dbConfig.zeroOrderSettings as any,
    customSettings: dbConfig.customSettings as any,
    createdAt: dbConfig.createdAt,
    updatedAt: dbConfig.updatedAt,
    createdBy: dbConfig.createdBy || undefined,
    notes: dbConfig.notes || undefined
  };
}

// Helper function to convert ClientDeliveryConfiguration to DB format
function configToDb(config: ClientDeliveryConfiguration, userId?: string) {
  return {
    configId: config.id,
    clientName: config.clientName,
    vendorName: config.vendorName,
    description: config.description,
    isActive: config.isActive,
    pricingTiers: config.pricingTiers as any,
    mileageRate: config.mileageRate,
    distanceThreshold: config.distanceThreshold,
    dailyDriveDiscounts: config.dailyDriveDiscounts as any,
    driverPaySettings: config.driverPaySettings as any,
    bridgeTollSettings: config.bridgeTollSettings as any,
    zeroOrderSettings: config.zeroOrderSettings as any ?? null,
    customSettings: config.customSettings as any,
    createdBy: userId,
    notes: config.notes,
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

// POST: Create/Update configuration
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
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
    const dbData = configToDb(config, user?.id);

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

// DELETE: Soft-delete a configuration (sets isActive to false)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
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
