#!/usr/bin/env tsx

/**
 * Targeted fix: sync ONLY the try-hungry DB row with the corrected in-memory config.
 * Does NOT touch any other vendor configuration.
 *
 * Run with: pnpm tsx scripts/fix-try-hungry-config.ts
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { TRY_HUNGRY } from '../src/lib/calculator/client-configurations';

config({ path: '.env.local' });
config({ path: '.env.development.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

async function fixTryHungryConfig() {
  console.log('Fixing try-hungry DB config...\n');

  // Show what we're writing
  console.log('In-memory values being written:');
  console.log(`  mileageRate: $${TRY_HUNGRY.mileageRate}`);
  console.log('  pricingTiers:');
  for (const tier of TRY_HUNGRY.pricingTiers) {
    const pct = tier.regularRatePercent ? ` (${(tier.regularRatePercent * 100)}%)` : '';
    console.log(`    HC ${tier.headcountMin}-${tier.headcountMax ?? '∞'} / FC $${tier.foodCostMin}-${tier.foodCostMax ?? '∞'} → $${tier.regularRate}${pct}`);
  }
  console.log();

  const existing = await prisma.deliveryConfiguration.findFirst({
    where: { configId: 'try-hungry' },
  });

  if (!existing) {
    console.log('No existing DB row — creating from in-memory config...');
    await prisma.deliveryConfiguration.create({
      data: {
        configId: TRY_HUNGRY.id,
        clientName: TRY_HUNGRY.clientName,
        vendorName: TRY_HUNGRY.vendorName,
        description: TRY_HUNGRY.description || null,
        isActive: TRY_HUNGRY.isActive,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pricingTiers: TRY_HUNGRY.pricingTiers as any,
        mileageRate: TRY_HUNGRY.mileageRate,
        distanceThreshold: TRY_HUNGRY.distanceThreshold,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dailyDriveDiscounts: TRY_HUNGRY.dailyDriveDiscounts as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        driverPaySettings: TRY_HUNGRY.driverPaySettings as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bridgeTollSettings: TRY_HUNGRY.bridgeTollSettings as any,
        notes: TRY_HUNGRY.notes || null,
        updatedAt: new Date(),
      },
    });
    console.log('✅ Created.\n');
  } else {
    console.log(`Existing DB row found (last updated: ${existing.updatedAt})`);
    console.log(`  Old mileageRate: $${existing.mileageRate}`);
    console.log(`  Old first tier: $${((existing.pricingTiers as unknown as Array<{ regularRate: number }>)[0])?.regularRate}`);
    console.log();

    await prisma.deliveryConfiguration.update({
      where: { configId: 'try-hungry' },
      data: {
        clientName: TRY_HUNGRY.clientName,
        vendorName: TRY_HUNGRY.vendorName,
        description: TRY_HUNGRY.description || null,
        isActive: TRY_HUNGRY.isActive,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pricingTiers: TRY_HUNGRY.pricingTiers as any,
        mileageRate: TRY_HUNGRY.mileageRate,
        distanceThreshold: TRY_HUNGRY.distanceThreshold,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dailyDriveDiscounts: TRY_HUNGRY.dailyDriveDiscounts as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        driverPaySettings: TRY_HUNGRY.driverPaySettings as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bridgeTollSettings: TRY_HUNGRY.bridgeTollSettings as any,
        notes: TRY_HUNGRY.notes || null,
        updatedAt: new Date(),
      },
    });
    console.log('✅ Updated.\n');
  }

  // Verify
  const updated = await prisma.deliveryConfiguration.findFirst({
    where: { configId: 'try-hungry' },
  });

  if (updated) {
    const tiers = updated.pricingTiers as unknown as Array<{
      headcountMin: number;
      headcountMax: number | null;
      regularRate: number;
      regularRatePercent?: number;
    }>;
    console.log('Verification — DB now has:');
    console.log(`  mileageRate: $${updated.mileageRate}`);
    for (const t of tiers) {
      const pct = t.regularRatePercent ? ` (${(t.regularRatePercent * 100)}%)` : '';
      console.log(`  HC ${t.headcountMin}-${t.headcountMax ?? '∞'} → $${t.regularRate}${pct}`);
    }
  }

  console.log('\nDone. Restart dev server and re-test the calculator.');
}

fixTryHungryConfig()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
