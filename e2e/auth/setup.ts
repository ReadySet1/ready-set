/**
 * Playwright Authentication Setup
 *
 * This script performs actual Supabase authentication and saves the session state
 * for reuse across all E2E tests, eliminating the need for repeated logins.
 *
 * Saves authenticated state to:
 * - e2e/.auth/client.json
 * - e2e/.auth/vendor.json
 * - e2e/.auth/admin.json (if admin user exists)
 */

import { chromium, type FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Test user credentials (must match test-data-setup.ts)
const TEST_USERS = {
  CLIENT: {
    email: 'test-client@example.com',
    password: 'TestPassword123!',
    role: 'CLIENT',
  },
  VENDOR: {
    email: 'test-vendor@example.com',
    password: 'TestPassword123!',
    role: 'VENDOR',
  },
  // Add ADMIN when available
  // ADMIN: {
  //   email: 'test-admin@example.com',
  //   password: 'TestPassword123!',
  //   role: 'ADMIN',
  // },
};

const authDir = path.join(__dirname, '..', '.auth');

/**
 * Performs Supabase authentication via UI and saves the storage state
 */
async function authenticate(
  baseURL: string,
  email: string,
  password: string,
  role: string
): Promise<string> {
  console.log(`\n🔐 Authenticating ${role}: ${email}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL,
  });
  const page = await context.newPage();

  try {
    // Navigate to sign-in page
    console.log('  → Navigating to sign-in page...');
    await page.goto('/sign-in', { waitUntil: 'networkidle' });

    // Fill in credentials
    console.log('  → Entering credentials...');
    await page.fill('input[name="email"], input[type="email"]', email);
    await page.fill('input[name="password"], input[type="password"]', password);

    // Submit form
    console.log('  → Submitting login form...');
    await page.click('button[type="submit"]');

    // Wait for successful navigation (any authenticated route)
    console.log('  → Waiting for authentication...');
    await page.waitForURL(/\/(admin|client|vendor|dashboard)/, {
      timeout: 15000,
      waitUntil: 'networkidle',
    });

    console.log(`  ✅ ${role} authenticated successfully`);

    // Save the storage state
    const authFile = path.join(authDir, `${role.toLowerCase()}.json`);
    await context.storageState({ path: authFile });
    console.log(`  💾 Auth state saved to: ${path.relative(process.cwd(), authFile)}`);

    return authFile;
  } catch (error) {
    console.error(`  ❌ Failed to authenticate ${role}:`, error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Global setup function run before all tests
 */
export default async function globalSetup(config: FullConfig) {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 E2E Authentication Setup');
  console.log('='.repeat(60));

  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';
  console.log(`Base URL: ${baseURL}`);

  // Create .auth directory if it doesn't exist
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log(`\n📁 Created auth directory: ${path.relative(process.cwd(), authDir)}`);
  }

  // Check if auth files already exist and are recent (< 1 hour old)
  const shouldSkip = Object.entries(TEST_USERS).every(([role]) => {
    const authFile = path.join(authDir, `${role.toLowerCase()}.json`);
    if (!fs.existsSync(authFile)) return false;

    const stats = fs.statSync(authFile);
    const ageInMs = Date.now() - stats.mtimeMs;
    const ageInMinutes = Math.floor(ageInMs / 1000 / 60);

    if (ageInMs < 60 * 60 * 1000) {
      // Less than 1 hour old
      console.log(`\n✓ ${role} auth state is recent (${ageInMinutes}m old) - skipping`);
      return true;
    }

    return false;
  });

  if (shouldSkip) {
    console.log('\n✅ All auth states are recent - skipping authentication');
    console.log('='.repeat(60) + '\n');
    return;
  }

  // Authenticate each user role
  try {
    for (const [role, credentials] of Object.entries(TEST_USERS)) {
      await authenticate(baseURL, credentials.email, credentials.password, role);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Authentication setup complete!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ Authentication setup failed!');
    console.error('Error:', error);
    console.error('\n⚠️  Please ensure:');
    console.error('  1. The development server is running (pnpm dev)');
    console.error('  2. Test users exist in the database (run e2e/test-data-setup.ts)');
    console.error('  3. Supabase credentials are configured correctly');
    console.error('='.repeat(60) + '\n');
    throw error;
  }
}
