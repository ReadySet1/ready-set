#!/usr/bin/env tsx

/**
 * Verify Restaurant Address Imports
 *
 * Checks how many restaurant addresses are in the database
 *
 * Run with: pnpm tsx scripts/verify-restaurant-imports.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyImports() {
  console.log('🔍 Verifying restaurant address imports...\n');

  try {
    // Count all restaurant addresses
    const totalRestaurants = await prisma.address.count({
      where: {
        isRestaurant: true,
      },
    });

    console.log(`📊 Total restaurant addresses: ${totalRestaurants}`);

    // Get a few sample restaurant addresses
    const sampleRestaurants = await prisma.address.findMany({
      where: {
        isRestaurant: true,
      },
      take: 10,
      orderBy: {
        name: 'asc',
      },
    });

    console.log('\n📋 Sample restaurant addresses:');
    console.log('─'.repeat(80));
    sampleRestaurants.forEach((restaurant, index) => {
      console.log(`${index + 1}. ${restaurant.name}`);
      console.log(`   ${restaurant.street1}${restaurant.street2 ? ', ' + restaurant.street2 : ''}`);
      console.log(`   ${restaurant.city}, ${restaurant.state} ${restaurant.zip}`);
      console.log(`   Shared: ${restaurant.isShared ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Group by state
    const byState = await prisma.address.groupBy({
      by: ['state'],
      where: {
        isRestaurant: true,
      },
      _count: {
        state: true,
      },
      orderBy: {
        _count: {
          state: 'desc',
        },
      },
    });

    console.log('📍 Restaurants by state:');
    console.log('─'.repeat(80));
    byState.forEach((stateCount) => {
      console.log(`   ${stateCount.state}: ${stateCount._count.state} restaurants`);
    });

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyImports().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

export default verifyImports;
