#!/usr/bin/env tsx

/**
 * Fix Test User Profiles
 *
 * Creates profiles for test users that already exist in auth
 *
 * Run with: pnpm tsx scripts/fix-test-user-profiles.ts
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const prisma = new PrismaClient();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

async function fixTestUserProfiles() {
  console.log('🔧 Fixing test user profiles...\n');

  try {
    // Get all auth users
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUsers = authData?.users || [];

    let successCount = 0;
    let failCount = 0;

    for (const [email, config] of Object.entries(testUserConfig)) {
      console.log(`\n📝 Processing ${config.type}: ${email}`);

      // Find auth user
      const authUser = authUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());

      if (!authUser) {
        console.log(`⚠️  Auth user not found. Creating...`);

        // Create auth user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: email,
          password: config.password,
          email_confirm: true,
          user_metadata: {
            full_name: config.name,
          },
        });

        if (createError || !newUser.user) {
          console.error(`❌ Error creating auth user:`, createError?.message);
          failCount++;
          continue;
        }

        console.log(`✅ Auth user created with ID: ${newUser.user.id}`);

        // Create profile using Prisma
        await prisma.profile.create({
          data: {
            id: newUser.user.id,
            email: email,
            name: config.name,
            type: config.type,
            status: 'ACTIVE',
          },
        });

        console.log(`✅ Profile created`);
        successCount++;
      } else {
        console.log(`✅ Found auth user with ID: ${authUser.id}`);

        // Update password
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          authUser.id,
          { password: config.password }
        );

        if (updateError) {
          console.error(`⚠️  Could not update password:`, updateError.message);
        } else {
          console.log(`✅ Password updated`);
        }

        // Upsert profile using Prisma
        await prisma.profile.upsert({
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

        console.log(`✅ Profile created/updated`);
        successCount++;
      }

      console.log(`\n   📧 Email: ${email}`);
      console.log(`   🔑 Password: ${config.password}`);
      console.log(`   👤 Type: ${config.type}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary');
    console.log('='.repeat(80));
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);

    if (successCount > 0) {
      console.log('\n📝 Test User Credentials:');
      console.log('─'.repeat(80));
      for (const [email, config] of Object.entries(testUserConfig)) {
        console.log(`\n${config.type}:`);
        console.log(`  Email: ${email}`);
        console.log(`  Password: ${config.password}`);
      }
      console.log('\n✅ You can now use these credentials to test the application!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixTestUserProfiles()
  .then(() => {
    console.log('\n🎉 Test user profiles fixed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
