#!/usr/bin/env tsx

/**
 * Seed Delivery Configurations Script
 *
 * Seeds in-memory client delivery configurations into the database,
 * including zeroOrderSettings. This ensures the DB has the current
 * production values as the baseline before operators start editing
 * via the Adjust Vendor Pricing UI.
 *
 * Run with:
 *   pnpm tsx scripts/seed-delivery-configurations.ts              # all configs
 *   pnpm tsx scripts/seed-delivery-configurations.ts --config-id try-hungry  # single config
 *
 * Production safety: when DATABASE_URL points to a production host,
 * the script requires an explicit --confirm flag to proceed.
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

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const configIdFlag = args.includes('--config-id')
  ? args[args.indexOf('--config-id') + 1]
  : undefined;
const confirmFlag = args.includes('--confirm');

// ---------------------------------------------------------------------------
// Production safety guard
// ---------------------------------------------------------------------------

const PRODUCTION_HOST_PATTERNS = [
  '.supabase.co',
  '.supabase.com',
  '.neon.tech',
  'rds.amazonaws.com',
  '.aivencloud.com',
];

function isProductionUrl(url: string | undefined): boolean {
  if (!url) return false;
  return PRODUCTION_HOST_PATTERNS.some((pattern) => url.includes(pattern));
}

if (isProductionUrl(process.env.DATABASE_URL) && !confirmFlag) {
  console.error(
    '❌ DATABASE_URL points to a production host.\n' +
    '   Re-run with --confirm to proceed:\n' +
    `   pnpm tsx scripts/seed-delivery-configurations.ts${configIdFlag ? ` --config-id ${configIdFlag}` : ''} --confirm`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function seedDeliveryConfigurations() {
  const allConfigs = Object.values(CLIENT_CONFIGURATIONS);

  // Scope to a single config if --config-id was provided
  const configs = configIdFlag
    ? allConfigs.filter((c) => c.id === configIdFlag)
    : allConfigs;

  if (configIdFlag && configs.length === 0) {
    console.error(`❌ No in-memory config found for id "${configIdFlag}".`);
    console.error('   Available ids:', allConfigs.map((c) => c.id).join(', '));
    process.exit(1);
  }

  console.log(
    configIdFlag
      ? `Seeding config "${configIdFlag}" to database...\n`
      : `Seeding all ${configs.length} delivery configurations to database...\n`,
  );

  let created = 0;
  let updated = 0;

  for (const cfg of configs) {
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
  console.log(`  Total:   ${configs.length}`);

  // Verify by reading back
  console.log('\nVerifying...');
  if (configIdFlag) {
    const seeded = await prisma.deliveryConfiguration.findUnique({
      where: { configId: configIdFlag },
    });
    if (seeded) {
      console.log(`  ${seeded.clientName}: mileageRate=$${seeded.mileageRate}, active=${seeded.isActive}`);
    }
  } else {
    const dbCount = await prisma.deliveryConfiguration.count();
    console.log(`  DB records: ${dbCount}`);
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
