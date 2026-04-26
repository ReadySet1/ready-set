#!/usr/bin/env tsx

/**
 * Seed Delivery Configurations Script
 *
 * Seeds ALL in-memory client delivery configurations into the database,
 * including zeroOrderSettings. This ensures the DB has the current
 * production values as the baseline before operators start editing
 * via the Adjust Vendor Pricing UI.
 *
 * Run with: pnpm tsx scripts/seed-delivery-configurations.ts
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  CLIENT_CONFIGURATIONS,
} from '../src/lib/calculator/client-configurations';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env.development.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

async function seedDeliveryConfigurations() {
  console.log('Seeding delivery configurations to database...\n');

  const allConfigs = Object.values(CLIENT_CONFIGURATIONS);
  console.log(`Found ${allConfigs.length} in-memory configurations\n`);

  let created = 0;
  let updated = 0;

  for (const cfg of allConfigs) {
    console.log(`Processing: ${cfg.clientName} (${cfg.id})`);

    const dbData = {
      configId: cfg.id,
      clientName: cfg.clientName,
      vendorName: cfg.vendorName,
      description: cfg.description || null,
      isActive: cfg.isActive,
      pricingTiers: cfg.pricingTiers as any,
      mileageRate: cfg.mileageRate,
      distanceThreshold: cfg.distanceThreshold,
      dailyDriveDiscounts: cfg.dailyDriveDiscounts as any,
      driverPaySettings: cfg.driverPaySettings as any,
      bridgeTollSettings: cfg.bridgeTollSettings as any,
      zeroOrderSettings: cfg.zeroOrderSettings as any ?? null,
      customSettings: cfg.customSettings as any ?? null,
      notes: cfg.notes || null,
      updatedAt: new Date(),
    };

    try {
      const existing = await prisma.deliveryConfiguration.findUnique({
        where: { configId: cfg.id },
      });

      if (existing) {
        await prisma.deliveryConfiguration.update({
          where: { configId: cfg.id },
          data: dbData,
        });
        console.log(`  Updated`);
        updated++;
      } else {
        await prisma.deliveryConfiguration.create({
          data: dbData,
        });
        console.log(`  Created`);
        created++;
      }
    } catch (error) {
      console.error(`  Failed to seed ${cfg.clientName}:`, error);
    }
  }

  console.log('\nSeed Summary:');
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Total:   ${allConfigs.length}`);

  // Verify by reading back
  console.log('\nVerifying...');
  const dbCount = await prisma.deliveryConfiguration.count();
  console.log(`  DB records: ${dbCount}`);

  const hyConfig = await prisma.deliveryConfiguration.findUnique({
    where: { configId: 'hy-food-company-direct' },
  });
  if (hyConfig) {
    const zos = hyConfig.zeroOrderSettings as any;
    console.log(`  HY Food Company zeroOrderSettings: ${zos ? `enabled=${zos.enabled}, readySetFee=$${zos.readySetFee}` : 'null'}`);
  }

  console.log('\nSeed complete!');
}

seedDeliveryConfigurations()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
