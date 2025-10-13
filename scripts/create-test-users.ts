#!/usr/bin/env tsx

/**
 * Create Test Users Script
 *
 * Creates test users for different roles in the dev database
 *
 * Run with: pnpm tsx scripts/create-test-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

// Supabase connection details
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface TestUser {
  email: string;
  password: string;
  type: 'VENDOR' | 'HELPDESK' | 'DRIVER';
  name: string;
}

const testUsers: TestUser[] = [
  {
    email: 'vendor.test@example.com',
    password: 'TestVendor123!',
    type: 'VENDOR',
    name: 'Test Vendor',
  },
  {
    email: 'helpdesk.test@example.com',
    password: 'TestHelpdesk123!',
    type: 'HELPDESK',
    name: 'Test Helpdesk',
  },
  {
    email: 'driver.test@example.com',
    password: 'TestDriver123!',
    type: 'DRIVER',
    name: 'Test Driver',
  },
];

async function createTestUser(user: TestUser): Promise<boolean> {
  console.log(`\n📝 Creating ${user.type} user: ${user.email}`);

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === user.email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      console.log(`⚠️  User already exists in auth. Updating password...`);
      userId = existingUser.id;

      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: user.password }
      );

      if (updateError) {
        console.error(`❌ Error updating password:`, updateError.message);
        return false;
      }
      console.log(`✅ Password updated successfully`);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.name,
        },
      });

      if (createError || !newUser.user) {
        console.error(`❌ Error creating user:`, createError?.message);
        return false;
      }

      userId = newUser.user.id;
      console.log(`✅ Auth user created with ID: ${userId}`);
    }

    // Check if profile exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (existingProfile) {
      console.log(`⚠️  Profile already exists. Updating...`);

      // Update existing profile
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({
          email: user.email,
          name: user.name,
          type: user.type,
          status: 'ACTIVE',
          updatedAt: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateProfileError) {
        console.error(`❌ Error updating profile:`, updateProfileError.message);
        return false;
      }
      console.log(`✅ Profile updated successfully`);
    } else {
      // Create new profile
      const { error: insertProfileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: user.email,
          name: user.name,
          type: user.type,
          status: 'ACTIVE',
        });

      if (insertProfileError) {
        console.error(`❌ Error creating profile:`, insertProfileError.message);
        return false;
      }
      console.log(`✅ Profile created successfully`);
    }

    // Display user info
    console.log(`\n   📧 Email: ${user.email}`);
    console.log(`   🔑 Password: ${user.password}`);
    console.log(`   👤 Type: ${user.type}`);
    console.log(`   🆔 ID: ${userId}`);

    return true;
  } catch (error) {
    console.error(`❌ Unexpected error:`, error);
    return false;
  }
}

async function createAllTestUsers() {
  console.log('🚀 Creating test users for dev database...');
  console.log('='.repeat(80));

  let successCount = 0;
  let failCount = 0;

  for (const user of testUsers) {
    const success = await createTestUser(user);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Summary');
  console.log('='.repeat(80));
  console.log(`✅ Successfully created/updated: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total: ${testUsers.length}`);

  if (successCount > 0) {
    console.log('\n📝 Test User Credentials:');
    console.log('─'.repeat(80));
    testUsers.forEach((user) => {
      console.log(`\n${user.type}:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password}`);
    });
    console.log('\n✅ You can now use these credentials to test the application!');
  }

  if (failCount > 0) {
    console.log('\n⚠️  Some users failed to create. Check the errors above.');
    process.exit(1);
  }
}

// Run the script
createAllTestUsers()
  .then(() => {
    console.log('\n🎉 Test user creation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });

export default createAllTestUsers;
