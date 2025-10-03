#!/usr/bin/env tsx
// Script to fix RLS permissions for profiles table
import { Client } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

async function fixRLSPermissions() {
  console.log('🔧 Fixing RLS permissions for profiles table...');

  // Get database connection details from environment
  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

  if (!databaseUrl) {
    console.error('❌ No DATABASE_URL or DIRECT_URL found in environment variables');
    console.log('Please set DATABASE_URL or DIRECT_URL in your .env file');
    process.exit(1);
  }

  // Parse the database URL to extract connection details
  const url = new URL(databaseUrl);
  const dbConfig = {
    host: url.hostname,
    port: parseInt(url.port, 10),
    database: url.pathname.slice(1), // Remove leading slash
    user: url.username,
    password: url.password,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };

  const client = new Client(dbConfig);

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Enable RLS on profiles table
    console.log('📋 Enabling RLS on profiles table...');
    await client.query('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;');
    console.log('✅ RLS enabled on profiles table');

    // Drop existing policies if they exist
    console.log('🗑️ Dropping existing policies...');
    const policiesToDrop = [
      'Users can view own profile',
      'Users can insert own profile',
      'Users can update own profile'
    ];

    for (const policyName of policiesToDrop) {
      try {
        await client.query(`DROP POLICY IF EXISTS "${policyName}" ON public.profiles;`);
        console.log(`✅ Dropped policy: ${policyName}`);
      } catch (error: any) {
        console.log(`ℹ️ Policy ${policyName} didn't exist or couldn't be dropped:`, error.message);
      }
    }

    // Create new policies
    console.log('📝 Creating new RLS policies...');

    const policies = [
      {
        name: 'Users can view own profile',
        sql: `
          CREATE POLICY "Users can view own profile" ON public.profiles
          FOR SELECT
          USING (auth.uid() = id::uuid);
        `
      },
      {
        name: 'Users can insert own profile',
        sql: `
          CREATE POLICY "Users can insert own profile" ON public.profiles
          FOR INSERT
          WITH CHECK (auth.uid() = id::uuid);
        `
      },
      {
        name: 'Users can update own profile',
        sql: `
          CREATE POLICY "Users can update own profile" ON public.profiles
          FOR UPDATE
          USING (auth.uid() = id::uuid)
          WITH CHECK (auth.uid() = id::uuid);
        `
      }
    ];

    for (const policy of policies) {
      try {
        await client.query(policy.sql);
        console.log(`✅ Created policy: ${policy.name}`);
      } catch (error: any) {
        console.error(`❌ Error creating policy "${policy.name}":`, error.message);
      }
    }

    // Grant permissions
    console.log('🔐 Granting permissions...');
    try {
      await client.query(`
        GRANT USAGE ON SCHEMA public TO anon, authenticated;
        GRANT ALL ON public.profiles TO authenticated;
        GRANT ALL ON public.profiles TO anon;
      `);
      console.log('✅ Permissions granted');
    } catch (error: any) {
      console.error('❌ Error granting permissions:', error.message);
    }

    console.log('🎉 RLS permissions fix completed!');

  } catch (error: any) {
    console.error('❌ Error fixing RLS permissions:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the fix
fixRLSPermissions().catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});