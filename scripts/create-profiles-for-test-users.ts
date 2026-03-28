#!/usr/bin/env tsx

/**
 * Create Profiles for Test Users
 *
 * Finds test users in auth.users and creates their profiles
 *
 * Run with: pnpm tsx scripts/create-profiles-for-test-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const testUserConfig: Record<string, { type: 'VENDOR' | 'HELPDESK' | 'DRIVER'; name: string; password: string }> = {
  'vendor.test@example.com': {
    type: 'VENDOR',
    name: 'Test Vendor',
    password: 'TestVendor123!',
  },
  'helpdesk.test@example.com': {
    type: 'HELPDESK',
    name: 'Test Helpdesk',
    password: 'TestHelpdesk123!',
  },
  'driver.test@example.com': {
    type: 'DRIVER',
    name: 'Test Driver',
    password: 'TestDriver123!',
  },
};

async function createProfilesForTestUsers() {
  console.log('🔧 Creating profiles for test users...\n');

  try {
    let successCount = 0;
    let notFoundCount = 0;

    for (const [email, config] of Object.entries(testUserConfig)) {
      console.log(`\n📝 Processing ${config.type}: ${email}`);

      // Query auth.users table directly using raw SQL
      const authUsers: Array<{ id: string; email: string }> = await prisma.$queryRawUnsafe(
        `SELECT id, email FROM auth.users WHERE email = $1`,
        email
      );

      if (authUsers.length === 0) {
        console.log(`⚠️  Auth user not found in database`);
        notFoundCount++;
        continue;
      }

      const authUser = authUsers[0];
      if (!authUser) {
        console.log(`⚠️  Auth user data is invalid`);
        notFoundCount++;
        continue;
      }

      console.log(`✅ Found auth user with ID: ${authUser.id}`);

      // Upsert profile using Prisma
      const profile = await prisma.profile.upsert({
        where: { id: authUser.id },
        update: {
          email: email,
          name: config.name,
          type: config.type,
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
        create: {
          id: authUser.id,
          email: email,
          name: config.name,
          type: config.type,
          status: 'ACTIVE',
        },
      });

      console.log(`✅ Profile ${profile.id ? 'updated' : 'created'} successfully`);
      console.log(`\n   📧 Email: ${email}`);
      console.log(`   🔑 Password: ${'*'.repeat(config.password.length)}`);
      console.log(`   👤 Type: ${config.type}`);
      console.log(`   🆔 ID: ${authUser.id}`);

      successCount++;
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary');
    console.log('='.repeat(80));
    console.log(`✅ Successfully created/updated: ${successCount}`);
    console.log(`⚠️  Auth users not found: ${notFoundCount}`);
    console.log(`📋 Total: ${Object.keys(testUserConfig).length}`);

    if (successCount > 0) {
      console.log('\n📝 Test User Credentials:');
      console.log('─'.repeat(80));
      for (const [email, config] of Object.entries(testUserConfig)) {
        console.log(`\n${config.type}:`);
        console.log(`  Email: ${email}`);
        console.log(`  Password: ${'*'.repeat(config.password.length)}`);
      }
      console.log('\n✅ You can now use these credentials to test the application!');
    }

    if (notFoundCount > 0) {
      console.log('\n⚠️  Some users were not found in auth.users.');
      console.log('   You may need to create them manually via Supabase dashboard.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createProfilesForTestUsers()
  .then(() => {
    console.log('\n🎉 Profile creation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
