#!/usr/bin/env tsx

/**
 * Fix Problematic Restaurant Addresses
 *
 * Manually fixes the 6 restaurant addresses that failed to parse
 *
 * Run with: pnpm tsx scripts/fix-problematic-restaurant-addresses.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Manually fixed addresses
const fixedAddresses = [
  {
    name: 'Thai Chili Express',
    street1: '304 E Santa Clara St',
    street2: 'S 7th St D',
    city: 'San Jose',
    state: 'CA',
    zip: '95113',
  },
  {
    name: 'Starbird Chicken (San Jose)',
    street1: '1088 E Brokaw Rd #10',
    street2: null,
    city: 'San Jose',
    state: 'CA',
    zip: '95131',
  },
  {
    name: 'Starbird (San Jose)',
    street1: '1088 E Brokaw Rd #10',
    street2: null,
    city: 'San Jose',
    state: 'CA',
    zip: '95131',
  },
  {
    name: 'Cocina Dona Maria',
    street1: '2215 Tasman Dr',
    street2: null,
    city: 'Santa Clara',
    state: 'CA',
    zip: '95054', // Fixed zip
  },
  {
    name: 'Kasa Indian Eatery',
    street1: '4001 18th St',
    street2: null,
    city: 'San Francisco',
    state: 'CA',
    zip: '94114',
  },
];

async function fixProblematicAddresses() {
  console.log('🔧 Fixing problematic restaurant addresses...\n');

  let successCount = 0;
  let skipCount = 0;

  try {
    for (const address of fixedAddresses) {
      // Check if this address already exists
      const existingAddress = await prisma.address.findFirst({
        where: {
          name: address.name,
          street1: address.street1,
          isRestaurant: true,
        },
      });

      if (existingAddress) {
        console.log(`⏭️  Skipping ${address.name} - Already exists`);
        skipCount++;
        continue;
      }

      // Create the address
      await prisma.address.create({
        data: {
          name: address.name,
          street1: address.street1,
          street2: address.street2,
          city: address.city,
          state: address.state,
          zip: address.zip,
          county: null,
          isRestaurant: true,
          isShared: true,
          createdBy: null,
        },
      });

      console.log(`✅ Fixed and imported: ${address.name}`);
      console.log(`   ${address.street1}, ${address.city}, ${address.state} ${address.zip}`);
      successCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Fix Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully fixed: ${successCount}`);
    console.log(`⏭️  Skipped (already exist): ${skipCount}`);
    console.log(`📋 Total processed: ${fixedAddresses.length}`);
    console.log('\n🎉 Fix complete!');

  } catch (error) {
    console.error('❌ Fatal error during fix:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixProblematicAddresses().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

export default fixProblematicAddresses;
