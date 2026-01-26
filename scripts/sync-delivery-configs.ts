#!/usr/bin/env tsx

/**
 * Sync Delivery Configurations Script
 *
 * Syncs the database DeliveryConfiguration table with the in-memory
 * CLIENT_CONFIGURATIONS. This ensures the database has the latest
 * flat fee pricing from client-configurations.ts.
 *
 * Run with: pnpm tsx scripts/sync-delivery-configs.ts
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  getActiveConfigurations,
  getConfiguration,
  CLIENT_CONFIGURATIONS,
} from '../src/lib/calculator/client-configurations';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env.development.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

async function syncDeliveryConfigurations() {
  console.log('🚀 Syncing delivery configurations to database...\n');

  try {
    const inMemoryConfigs = getActiveConfigurations();
    console.log(`📋 Found ${inMemoryConfigs.length} active in-memory configurations\n`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const config of inMemoryConfigs) {
      console.log(`Processing: ${config.clientName} (${config.id})`);

      // Check if exists in database
      const existing = await prisma.deliveryConfiguration.findUnique({
        where: { configId: config.id },
      });

      const dbData = {
        configId: config.id,
        clientName: config.clientName,
        vendorName: config.vendorName,
        description: config.description || null,
        isActive: config.isActive,
        pricingTiers: config.pricingTiers as any,
        mileageRate: config.mileageRate,
        distanceThreshold: config.distanceThreshold,
        dailyDriveDiscounts: config.dailyDriveDiscounts as any,
        driverPaySettings: config.driverPaySettings as any,
        bridgeTollSettings: config.bridgeTollSettings as any,
        customSettings: config.customSettings as any || null,
        notes: config.notes || null,
        updatedAt: new Date(),
      };

      if (existing) {
        // Update existing
        await prisma.deliveryConfiguration.update({
          where: { configId: config.id },
          data: dbData,
        });
        console.log(`  ✅ Updated`);
        updated++;
      } else {
        // Create new
        await prisma.deliveryConfiguration.create({
          data: dbData,
        });
        console.log(`  ✅ Created`);
        created++;
      }
    }

    console.log('\n📊 Sync Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);

    // Verify the sync by checking a key config
    console.log('\n🔍 Verifying Ready Set Food Standard config...');
    const readySetConfig = await prisma.deliveryConfiguration.findUnique({
      where: { configId: 'ready-set-food-standard' },
    });

    if (readySetConfig) {
      const tiers = readySetConfig.pricingTiers as any[];
      console.log(`   Config found: ${readySetConfig.clientName}`);
      console.log(`   Pricing tiers: ${tiers?.length || 0}`);

      // Check if flat fee is applied (within10Miles should equal regularRate)
      if (tiers && tiers.length > 0) {
        const firstTier = tiers[0];
        const isFlat = firstTier.within10Miles === firstTier.regularRate;
        console.log(`   Tier 1: regularRate=$${firstTier.regularRate}, within10Miles=$${firstTier.within10Miles}`);
        console.log(`   Flat fee pricing: ${isFlat ? '✅ YES' : '❌ NO'}`);
      }
    }

    console.log('\n🎉 Sync complete!');

  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncDeliveryConfigurations()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
