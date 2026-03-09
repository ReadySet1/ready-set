#!/usr/bin/env tsx

/**
 * Seed script to populate default pricing tiers
 * Run with: pnpm tsx scripts/seed-pricing-tiers.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { PRICING_TIER_CONSTANTS } from '../src/types/pricing';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting pricing tiers seeding...');

  try {
    // Check if pricing tiers already exist
    const existingTiers = await (prisma as any).pricingTier.count();
    
    if (existingTiers > 0) {
      console.log(`⚠️  Found ${existingTiers} existing pricing tiers. Skipping seed to avoid duplicates.`);
      console.log('   If you want to reseed, delete existing tiers first.');
      return;
    }

    // Create pricing tiers from constants
    console.log('📊 Creating pricing tiers...');
    
    for (const [index, tierData] of PRICING_TIER_CONSTANTS.DEFAULT_TIERS.entries()) {
      const data = tierData as any; // Type assertion to access all properties
      const tier = await (prisma as any).pricingTier.create({
        data: {
          minHeadCount: data.minHeadCount,
          maxHeadCount: data.maxHeadCount || null,
          minFoodCost: new Decimal(data.minFoodCost),
          maxFoodCost: data.maxFoodCost ? new Decimal(data.maxFoodCost) : null,
          priceWithTip: data.priceWithTip ? new Decimal(data.priceWithTip) : null,
          priceWithoutTip: data.priceWithoutTip ? new Decimal(data.priceWithoutTip) : null,
          percentageWithTip: data.percentageWithTip ? new Decimal(data.percentageWithTip) : null,
          percentageWithoutTip: data.percentageWithoutTip ? new Decimal(data.percentageWithoutTip) : null,
          isActive: true,
        },
      });

      const tierDescription = tier.maxHeadCount 
        ? `${tier.minHeadCount}-${tier.maxHeadCount} heads`
        : `${tier.minHeadCount}+ heads`;
      
      const priceDescription = tier.percentageWithTip 
        ? `${tier.percentageWithTip}%/${tier.percentageWithoutTip}% of food cost`
        : `$${tier.priceWithTip}/$${tier.priceWithoutTip}`;

      console.log(`✅ Created tier ${index + 1}: ${tierDescription} - ${priceDescription}`);
    }

    console.log('\n📋 Pricing Tier Summary:');
    console.log('┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐');
    console.log('│ Head Count      │ Food Cost       │ Price w/Tip     │ Price w/o Tip   │');
    console.log('├─────────────────┼─────────────────┼─────────────────┼─────────────────┤');
    
    const allTiers = await (prisma as any).pricingTier.findMany({
      orderBy: { minHeadCount: 'asc' }
    });

    for (const tier of allTiers) {
      const headCount = tier.maxHeadCount 
        ? `${tier.minHeadCount}-${tier.maxHeadCount}`.padEnd(15)
        : `${tier.minHeadCount}+`.padEnd(15);
      
      const foodCost = tier.maxFoodCost 
        ? `$${tier.minFoodCost}-$${tier.maxFoodCost}`.padEnd(15)
        : `$${tier.minFoodCost}+`.padEnd(15);
      
      const priceWithTip = tier.percentageWithTip 
        ? `${tier.percentageWithTip}% of cost`.padEnd(15)
        : `$${tier.priceWithTip}`.padEnd(15);
      
      const priceWithoutTip = tier.percentageWithoutTip 
        ? `${tier.percentageWithoutTip}% of cost`.padEnd(15)
        : `$${tier.priceWithoutTip}`.padEnd(15);

      console.log(`│ ${headCount} │ ${foodCost} │ ${priceWithTip} │ ${priceWithoutTip} │`);
    }
    
    console.log('└─────────────────┴─────────────────┴─────────────────┴─────────────────┘');
    console.log(`\n🎉 Successfully created ${allTiers.length} pricing tiers!`);

  } catch (error) {
    console.error('❌ Error seeding pricing tiers:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

export default main; 