#!/usr/bin/env node

/**
 * Supabase Connection Verification Script
 * 
 * This script verifies that your Supabase environment variables are correctly configured
 * and that the connection to your Supabase project is working.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function verifySupabaseConnection() {
  console.log('🔍 Verifying Supabase Configuration...\n');

  // Check required environment variables
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  const optionalVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ];

  let hasErrors = false;

  console.log('📋 Environment Variables Check:');
  console.log('================================');

  // Check required variables
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`❌ ${varName}: MISSING`);
      hasErrors = true;
    }
  });

  // Check optional variables
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value && !value.includes('your_')) {
      console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`⚠️  ${varName}: Not configured`);
    }
  });

  if (hasErrors) {
    console.log('\n❌ Missing required environment variables. Please check your .env file.');
    process.exit(1);
  }

  // Test Supabase connection
  console.log('\n🔗 Testing Supabase Connection:');
  console.log('===============================');

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test basic connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      if (error.message.includes('relation "public.users" does not exist')) {
        console.log('✅ Connection successful (users table not yet created)');
      } else {
        console.log(`⚠️  Connection established but received error: ${error.message}`);
      }
    } else {
      console.log('✅ Connection successful and users table accessible');
    }

    // Test auth
    const { data: session } = await supabase.auth.getSession();
    console.log('✅ Auth client initialized successfully');

  } catch (error) {
    console.log(`❌ Connection failed: ${error}`);
    hasErrors = true;
  }

  console.log('\n📊 Summary:');
  console.log('===========');
  if (hasErrors) {
    console.log('❌ Some issues were found. Please check the errors above.');
    console.log('📖 Refer to SUPABASE_SETUP_SUMMARY.md for setup instructions.');
  } else {
    console.log('✅ Supabase configuration looks good!');
    console.log('🚀 Ready to use Supabase in your development environment.');
  }
}

verifySupabaseConnection().catch(console.error);
