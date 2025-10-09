/**
 * Script to delete specific test users from the database
 * 
 * This script will:
 * 1. Find users by email
 * 2. Delete from Supabase Auth
 * 3. Delete from database (cascades to related records)
 * 
 * Usage: pnpm tsx scripts/delete-specific-users.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

// Load environment variables from .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Prisma client directly
const prisma = new PrismaClient();

// Initialize Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Users to delete
const usersToDelete = [
  'cromo181@gmail.com',
  'austin@readysetllc.com',
  'info@readysetllc.com',
  'cardernasfernando874@gmail.com'
];

interface DeletionResult {
  email: string;
  status: 'success' | 'not_found' | 'error';
  message: string;
  userId?: string;
}

async function deleteUser(email: string): Promise<DeletionResult> {
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    console.log(`\n📧 Processing: ${normalizedEmail}`);
    
    // Step 1: Find user in database
    const profile = await prisma.profile.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        type: true,
        name: true
      }
    });

    if (!profile) {
      console.log(`   ⚠️  User not found in database`);
      
      // Check if user exists in Supabase Auth only
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.error(`   ❌ Error checking Supabase Auth:`, listError.message);
        return {
          email: normalizedEmail,
          status: 'error',
          message: `Error checking auth: ${listError.message}`
        };
      }
      
      const authUser = authUsers.users.find(u => u.email?.toLowerCase() === normalizedEmail);
      
      if (authUser) {
        console.log(`   🔍 Found in Supabase Auth only, deleting...`);
        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        
        if (deleteAuthError) {
          console.error(`   ❌ Error deleting from Supabase Auth:`, deleteAuthError.message);
          return {
            email: normalizedEmail,
            status: 'error',
            message: `Error deleting from auth: ${deleteAuthError.message}`,
            userId: authUser.id
          };
        }
        
        console.log(`   ✅ Deleted from Supabase Auth`);
        return {
          email: normalizedEmail,
          status: 'success',
          message: 'Deleted from Supabase Auth only',
          userId: authUser.id
        };
      }
      
      return {
        email: normalizedEmail,
        status: 'not_found',
        message: 'User not found in database or auth'
      };
    }

    console.log(`   👤 Found: ${profile.name} (${profile.type})`);
    console.log(`   🆔 User ID: ${profile.id}`);

    // Step 2: Check for SUPER_ADMIN protection
    if (profile.type === 'SUPER_ADMIN') {
      console.log(`   🛡️  SUPER_ADMIN user - SKIPPING (protected from deletion)`);
      return {
        email: normalizedEmail,
        status: 'error',
        message: 'Cannot delete SUPER_ADMIN users',
        userId: profile.id
      };
    }

    // Step 3: Delete from database (this will cascade to related records)
    console.log(`   🗑️  Deleting from database...`);
    await prisma.$transaction(async (tx) => {
      // Delete dispatch records first (no CASCADE defined)
      const deletedDispatches = await tx.dispatch.deleteMany({
        where: {
          OR: [
            { driverId: profile.id },
            { userId: profile.id }
          ]
        }
      });
      console.log(`      - Deleted ${deletedDispatches.count} dispatch records`);

      // Handle addresses - set createdBy to null instead of deleting
      const updatedAddresses = await tx.address.updateMany({
        where: { createdBy: profile.id },
        data: { createdBy: null }
      });
      console.log(`      - Updated ${updatedAddresses.count} addresses (set createdBy to null)`);

      // Delete profile (triggers CASCADE for related records)
      await tx.profile.delete({
        where: { id: profile.id }
      });
      console.log(`      - Deleted profile and related records`);
    });

    console.log(`   ✅ Deleted from database`);

    // Step 4: Delete from Supabase Auth
    console.log(`   🔑 Deleting from Supabase Auth...`);
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);

    if (deleteAuthError) {
      console.error(`   ⚠️  Error deleting from Supabase Auth:`, deleteAuthError.message);
      console.log(`   ℹ️  Database deletion completed, but auth deletion failed`);
      return {
        email: normalizedEmail,
        status: 'success',
        message: 'Deleted from database, but auth deletion failed',
        userId: profile.id
      };
    }

    console.log(`   ✅ Deleted from Supabase Auth`);
    console.log(`   🎉 User completely removed`);

    return {
      email: normalizedEmail,
      status: 'success',
      message: 'User completely deleted',
      userId: profile.id
    };

  } catch (error: any) {
    console.error(`   ❌ Error:`, error.message);
    return {
      email: normalizedEmail,
      status: 'error',
      message: error.message
    };
  }
}

async function main() {
  console.log('🚀 Starting user deletion process...\n');
  console.log('📋 Users to delete:');
  usersToDelete.forEach(email => console.log(`   - ${email}`));
  console.log('');

  const results: DeletionResult[] = [];

  for (const email of usersToDelete) {
    const result = await deleteUser(email);
    results.push(result);
    
    // Add a small delay between deletions
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DELETION SUMMARY');
  console.log('='.repeat(60));

  const successCount = results.filter(r => r.status === 'success').length;
  const notFoundCount = results.filter(r => r.status === 'not_found').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  console.log(`\n✅ Successfully deleted: ${successCount}`);
  console.log(`⚠️  Not found: ${notFoundCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  console.log('\nDetailed Results:');
  results.forEach(result => {
    const icon = result.status === 'success' ? '✅' : 
                 result.status === 'not_found' ? '⚠️' : '❌';
    console.log(`${icon} ${result.email}: ${result.message}`);
  });

  console.log('\n' + '='.repeat(60));
}

// Run the script
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('\n✨ Script completed');
  });
