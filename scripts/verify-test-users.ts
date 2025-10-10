#!/usr/bin/env tsx

/**
 * Verify Test Users
 *
 * Checks that test users exist and have correct profiles
 *
 * Run with: pnpm tsx scripts/verify-test-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyTestUsers() {
  console.log('🔍 Verifying test users...\n');

  try {
    const testEmails = [
      'vendor.test@example.com',
      'helpdesk.test@example.com',
      'driver.test@example.com',
    ];

    console.log('📋 Test User Details:');
    console.log('='.repeat(80));

    for (const email of testEmails) {
      const profile = await prisma.profile.findFirst({
        where: { email },
      });

      if (!profile) {
        console.log(`❌ ${email} - Profile not found`);
        continue;
      }

      console.log(`\n✅ ${profile.name} (${profile.type})`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   ID: ${profile.id}`);
      console.log(`   Status: ${profile.status}`);
      console.log(`   Created: ${profile.createdAt}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTestUsers();
