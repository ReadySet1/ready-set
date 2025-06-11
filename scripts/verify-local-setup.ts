#!/usr/bin/env tsx

/**
 * Local Development Verification Script
 * 
 * This script verifies that your development environment is properly configured
 * to use local services and NOT touch production databases or services.
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local', override: true });

interface VerificationResult {
  service: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

function addResult(service: string, status: 'PASS' | 'FAIL' | 'WARNING', message: string, details?: string) {
  results.push({ service, status, message, details });
}

async function verifyEnvironmentVariables() {
  console.log('🔍 Verifying Environment Variables...\n');

  // Database URLs
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    addResult('Database', 'FAIL', 'DATABASE_URL not found in environment');
  } else if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')) {
    addResult('Database', 'PASS', 'DATABASE_URL points to localhost', databaseUrl);
  } else {
    addResult('Database', 'WARNING', 'DATABASE_URL does not appear to be localhost', databaseUrl);
  }

  if (!directUrl) {
    addResult('Direct Database', 'FAIL', 'DIRECT_URL not found in environment');
  } else if (directUrl.includes('localhost') || directUrl.includes('127.0.0.1')) {
    addResult('Direct Database', 'PASS', 'DIRECT_URL points to localhost', directUrl);
  } else {
    addResult('Direct Database', 'WARNING', 'DIRECT_URL does not appear to be localhost', directUrl);
  }

  // Supabase URLs
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    addResult('Supabase', 'FAIL', 'NEXT_PUBLIC_SUPABASE_URL not found');
  } else if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('54321')) {
    addResult('Supabase', 'PASS', 'Supabase URL points to local instance', supabaseUrl);
  } else if (supabaseUrl.includes('supabase.co')) {
    addResult('Supabase', 'WARNING', '⚠️  Supabase URL points to production instance', supabaseUrl);
  } else {
    addResult('Supabase', 'WARNING', 'Supabase URL configuration unclear', supabaseUrl);
  }

  // Node Environment
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'development') {
    addResult('Environment', 'PASS', `NODE_ENV is set to ${nodeEnv}`);
  } else {
    addResult('Environment', 'WARNING', `NODE_ENV is ${nodeEnv}, should be 'development'`);
  }
}

async function verifyDatabaseConnection() {
  console.log('🔍 Verifying Database Connection...\n');

  try {
    const prisma = new PrismaClient();
    
    // Try to connect to the database
    await prisma.$connect();
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT current_database(), current_user, version()`;
    
    addResult('Prisma Connection', 'PASS', 'Successfully connected to database', JSON.stringify(result, null, 2));
    
    // Check if we're connected to the right database
    const dbInfo = result as any[];
    if (dbInfo.length > 0) {
      const dbName = dbInfo[0].current_database;
      if (dbName === 'ready_set_dev') {
        addResult('Database Name', 'PASS', `Connected to correct development database: ${dbName}`);
      } else {
        addResult('Database Name', 'WARNING', `Connected to database: ${dbName} (expected: ready_set_dev)`);
      }
    }
    
    await prisma.$disconnect();
  } catch (error) {
    addResult('Prisma Connection', 'FAIL', 'Failed to connect to database', error instanceof Error ? error.message : String(error));
  }
}

async function verifySupabaseConnection() {
  console.log('🔍 Verifying Supabase Connection...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    addResult('Supabase Connection', 'FAIL', 'Supabase credentials not found');
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Try to get the current session (should be null for unauthenticated)
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      addResult('Supabase Connection', 'FAIL', 'Failed to connect to Supabase', error.message);
    } else {
      addResult('Supabase Connection', 'PASS', 'Successfully connected to Supabase');
      
      // Check if it's a local instance
      if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
        addResult('Supabase Instance', 'PASS', 'Connected to local Supabase instance');
      } else {
        addResult('Supabase Instance', 'WARNING', '⚠️  Connected to remote Supabase instance');
      }
    }
  } catch (error) {
    addResult('Supabase Connection', 'FAIL', 'Error connecting to Supabase', error instanceof Error ? error.message : String(error));
  }
}

async function verifyDockerServices() {
  console.log('🔍 Verifying Docker Services...\n');

  try {
    const { execSync } = require('child_process');
    
    // Check if Docker is running
    try {
      execSync('docker info', { stdio: 'pipe' });
      addResult('Docker', 'PASS', 'Docker is running');
    } catch {
      addResult('Docker', 'FAIL', 'Docker is not running or not installed');
      return;
    }

    // Check if PostgreSQL containers are running
    try {
      const containers = execSync('docker ps --format "table {{.Names}}\\t{{.Status}}"', { encoding: 'utf8' });
      
      if (containers.includes('ready-set-postgres-dev')) {
        addResult('PostgreSQL Dev', 'PASS', 'Development PostgreSQL container is running');
      } else {
        addResult('PostgreSQL Dev', 'WARNING', 'Development PostgreSQL container is not running');
      }

      if (containers.includes('ready-set-postgres-test')) {
        addResult('PostgreSQL Test', 'PASS', 'Test PostgreSQL container is running');
      } else {
        addResult('PostgreSQL Test', 'WARNING', 'Test PostgreSQL container is not running');
      }
    } catch (error) {
      addResult('Docker Containers', 'FAIL', 'Failed to check Docker containers', error instanceof Error ? error.message : String(error));
    }
  } catch (error) {
    addResult('Docker Check', 'FAIL', 'Failed to verify Docker', error instanceof Error ? error.message : String(error));
  }
}

function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 LOCAL DEVELOPMENT VERIFICATION RESULTS');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const warnings = results.filter(r => r.status === 'WARNING').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  // Group results by status
  const statusGroups = {
    PASS: results.filter(r => r.status === 'PASS'),
    WARNING: results.filter(r => r.status === 'WARNING'),
    FAIL: results.filter(r => r.status === 'FAIL')
  };

  Object.entries(statusGroups).forEach(([status, items]) => {
    if (items.length === 0) return;

    const emoji = status === 'PASS' ? '✅' : status === 'WARNING' ? '⚠️' : '❌';
    console.log(`${emoji} ${status} (${items.length})`);
    console.log('-'.repeat(40));

    items.forEach(result => {
      console.log(`  ${result.service}: ${result.message}`);
      if (result.details) {
        console.log(`    ${result.details}`);
      }
    });
    console.log('');
  });

  // Summary
  console.log('📊 SUMMARY');
  console.log('-'.repeat(40));
  console.log(`✅ Passed: ${passed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');

  // Recommendations
  if (failed > 0) {
    console.log('🚨 CRITICAL ISSUES FOUND:');
    console.log('Please fix the failed checks before proceeding with development.');
    console.log('');
  }

  if (warnings > 0) {
    console.log('⚠️  WARNINGS:');
    console.log('Review the warnings to ensure you\'re running against local services.');
    console.log('');
  }

  if (failed === 0 && warnings === 0) {
    console.log('🎉 ALL CHECKS PASSED!');
    console.log('Your local development environment is properly configured.');
    console.log('You can safely run your application without touching production services.');
    console.log('');
  }

  // Next steps
  console.log('🚀 NEXT STEPS:');
  if (failed > 0 || warnings > 0) {
    console.log('1. Fix any critical issues (failed checks)');
    console.log('2. Review and resolve warnings');
    console.log('3. Run this script again to verify');
    console.log('4. Start your development server with: pnpm dev');
  } else {
    console.log('1. Start your development server: pnpm dev');
    console.log('2. Your app will run against local services only');
    console.log('3. Safe to develop and test without affecting production');
  }
  console.log('');
}

async function main() {
  console.log('🚀 Starting Local Development Verification...\n');
  
  await verifyEnvironmentVariables();
  await verifyDatabaseConnection();
  await verifySupabaseConnection();
  await verifyDockerServices();
  
  printResults();
  
  // Exit with error code if there are failures
  const failed = results.filter(r => r.status === 'FAIL').length;
  process.exit(failed > 0 ? 1 : 0);
}

// Run the verification
main().catch((error) => {
  console.error('❌ Verification script failed:', error);
  process.exit(1);
}); 