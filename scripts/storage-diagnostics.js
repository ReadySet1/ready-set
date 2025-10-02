#!/usr/bin/env node

/**
 * Supabase Storage Diagnostics Script
 * This script helps diagnose and fix storage configuration issues
 */

const { createClient } = require('@supabase/supabase-js');

// Get credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function diagnoseStorage() {
  console.log('🔍 SUPABASE STORAGE DIAGNOSTICS\n');

  // Check environment variables
  console.log('1. Checking environment variables...');
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL not set');
    return;
  }
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
    return;
  }
  if (!anonKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
    return;
  }
  console.log('✅ All environment variables are set');

  // Test connections
  console.log('\n2. Testing Supabase connections...');

  // Test with service role key
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  console.log('✅ Admin client created');

  // Test with anon key
  const anonClient = createClient(supabaseUrl, anonKey);
  console.log('✅ Anon client created');

  // Check if storage is accessible
  console.log('\n3. Checking storage access...');
  try {
    const { data: buckets, error } = await adminClient.storage.listBuckets();

    if (error) {
      console.error('❌ Storage not accessible:', error.message);
      console.log('\n💡 This usually means:');
      console.log('   - Storage is not enabled in your Supabase project');
      console.log('   - Service role key does not have storage permissions');
      return;
    }

    console.log(`✅ Storage is accessible! Found ${buckets.length} buckets:`);
    buckets.forEach(bucket => {
      console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });

    // Check for required buckets
    const requiredBuckets = ['fileUploader', 'user-assets', 'catering-files', 'quarantined-files'];
    const existingBuckets = buckets.map(b => b.name);

    console.log('\n4. Checking required buckets...');
    for (const bucketName of requiredBuckets) {
      if (existingBuckets.includes(bucketName)) {
        console.log(`   ✅ ${bucketName}`);
      } else {
        console.log(`   ❌ ${bucketName} (missing)`);

        // Try to create it
        console.log(`   🔧 Creating ${bucketName}...`);
        try {
          const { error: createError } = await adminClient.storage.createBucket(bucketName, {
            public: false,
            fileSizeLimit: 10 * 1024 * 1024, // 10MB
          });

          if (createError) {
            console.error(`   ❌ Failed to create ${bucketName}:`, createError.message);
          } else {
            console.log(`   ✅ Created ${bucketName}`);
          }
        } catch (createError) {
          console.error(`   ❌ Exception creating ${bucketName}:`, createError.message);
        }
      }
    }

    console.log('\n✅ Storage diagnostics completed!');

  } catch (error) {
    console.error('❌ Storage diagnostics failed:', error.message);
  }
}

// Run diagnostics if this script is executed directly
if (require.main === module) {
  diagnoseStorage();
}

module.exports = { diagnoseStorage };
