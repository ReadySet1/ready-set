/**
 * API Route: Calculator Configurations
 * Handles CRUD operations for client delivery configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/prisma';
import {
  ClientDeliveryConfiguration,
  validateConfiguration,
  getActiveConfigurations,
  getConfiguration
} from '@/lib/calculator/client-configurations';

// Helper function to convert DB record to ClientDeliveryConfiguration
// Merges with in-memory configuration for fields not stored in database (e.g., zeroOrderSettings)
function dbToConfig(dbConfig: any): ClientDeliveryConfiguration {
  // Get the in-memory configuration to merge any fields not in the database
  const inMemoryConfig = getConfiguration(dbConfig.configId);
  
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
    // Merge zeroOrderSettings from in-memory config (not stored in database yet)
    zeroOrderSettings: dbConfig.zeroOrderSettings || inMemoryConfig?.zeroOrderSettings,
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
    customSettings: config.customSettings as any,
    createdBy: userId,
    notes: config.notes,
    updatedAt: new Date()
  };
}

// GET: Fetch all configurations or a specific one
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (configId) {
      try {
        // Try to fetch from database first
        const dbConfig = await prisma.deliveryConfiguration.findUnique({
          where: { configId }
        });

        if (dbConfig) {
          return NextResponse.json({ success: true, data: dbToConfig(dbConfig) });
        }
      } catch (dbError) {
        console.warn('Database query failed, falling back to in-memory configs:', dbError);
      }

      // Fallback to in-memory configurations
      const config = getConfiguration(configId);
      if (!config) {
        return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: config });
    } else {
      try {
        // Try to fetch all from database
        const dbConfigs = await prisma.deliveryConfiguration.findMany({
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' }
        });

        // If DB has configs, return them
        if (dbConfigs.length > 0) {
          const configurations = dbConfigs.map(dbToConfig);
          return NextResponse.json({ success: true, data: configurations });
        }
      } catch (dbError) {
        console.warn('Database query failed, falling back to in-memory configs:', dbError);
      }

      // Fallback to in-memory defaults
      const configurations = getActiveConfigurations();
      return NextResponse.json({ success: true, data: configurations });
    }
  } catch (error) {
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
    console.error('Error saving configuration:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a configuration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (!configId) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    await prisma.deliveryConfiguration.delete({
      where: { configId }
    });

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    );
  }
}
