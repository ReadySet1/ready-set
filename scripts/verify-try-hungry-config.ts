#!/usr/bin/env tsx

/**
 * Read-only verification: compare DB vs in-memory Try Hungry pricing tiers.
 * Run with: pnpm tsx scripts/verify-try-hungry-config.ts
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { TRY_HUNGRY } from '../src/lib/calculator/client-configurations';

config({ path: '.env.local' });
config({ path: '.env.development.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

interface PricingTier {
  headcountMin: number;
  headcountMax: number | null;
  foodCostMin: number;
  foodCostMax: number | null;
  regularRate: number;
  within10Miles: number;
  regularRatePercent?: number;
  within10MilesPercent?: number;
}

async function verify() {
  const dbRow = await prisma.deliveryConfiguration.findFirst({
    where: { configId: TRY_HUNGRY.id },
  });

  if (!dbRow) {
    console.log('❌ No DB row found for try-hungry — in-memory fallback will be used.');
    return;
  }

  console.log('=== DB row for try-hungry ===');
  console.log(`  clientName: ${dbRow.clientName}`);
  console.log(`  isActive:   ${dbRow.isActive}`);
  console.log(`  updatedAt:  ${dbRow.updatedAt}`);
  console.log(`  mileageRate: ${dbRow.mileageRate}`);
  console.log();

  const dbTiers = dbRow.pricingTiers as unknown as PricingTier[];
  const memTiers = TRY_HUNGRY.pricingTiers;

  console.log('=== Pricing Tiers: DB vs In-Memory ===');
  console.log(
    'Tier'.padEnd(12),
    'DB regular'.padEnd(14),
    'Mem regular'.padEnd(14),
    'DB w/10mi'.padEnd(14),
    'Mem w/10mi'.padEnd(14),
    'DB %'.padEnd(10),
    'Mem %'.padEnd(10),
    'Match?',
  );

  const maxLen = Math.max(dbTiers.length, memTiers.length);
  let allMatch = true;

  for (let i = 0; i < maxLen; i++) {
    const db = dbTiers[i];
    const mem = memTiers[i];
    const label = mem
      ? `${mem.headcountMin}-${mem.headcountMax ?? '∞'}`
      : `(extra #${i})`;

    const dbReg = db?.regularRate ?? '—';
    const memReg = mem?.regularRate ?? '—';
    const dbW10 = db?.within10Miles ?? '—';
    const memW10 = mem?.within10Miles ?? '—';
    const dbPct = db?.regularRatePercent != null ? `${(db.regularRatePercent * 100).toFixed(0)}%` : '—';
    const memPct = mem?.regularRatePercent != null ? `${(mem.regularRatePercent * 100).toFixed(0)}%` : '—';

    const match =
      db?.regularRate === mem?.regularRate &&
      db?.within10Miles === mem?.within10Miles &&
      db?.regularRatePercent === mem?.regularRatePercent &&
      db?.within10MilesPercent === mem?.within10MilesPercent;

    if (!match) allMatch = false;

    console.log(
      label.padEnd(12),
      String(dbReg).padEnd(14),
      String(memReg).padEnd(14),
      String(dbW10).padEnd(14),
      String(memW10).padEnd(14),
      String(dbPct).padEnd(10),
      String(memPct).padEnd(10),
      match ? '✅' : '❌ MISMATCH',
    );
  }

  console.log();

  // Also check driverPaySettings
  const dbDriverPay = dbRow.driverPaySettings as Record<string, unknown>;
  console.log('=== Driver Pay Settings (DB) ===');
  console.log(`  requiresManualReview: ${dbDriverPay.requiresManualReview}`);
  console.log(`  readySetFeeMatchesDeliveryFee: ${dbDriverPay.readySetFeeMatchesDeliveryFee}`);
  console.log(`  maxPayPerDrop: ${dbDriverPay.maxPayPerDrop}`);
  console.log();

  if (allMatch) {
    console.log('✅ DB and in-memory configs are in sync.');
  } else {
    console.log('❌ DB and in-memory configs DIFFER. The DB values are authoritative.');
    console.log('   Fix: re-seed with `pnpm tsx scripts/seed-delivery-configurations.ts`');
    console.log('   Or update via VendorPricingEditor at /admin/calculator → Try Hungry');
  }
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
