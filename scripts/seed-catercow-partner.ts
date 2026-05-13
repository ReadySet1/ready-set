#!/usr/bin/env tsx
/**
 * Issue a CaterCow API key and seed the api_partners row.
 *
 * Generates a fresh 256-bit key with crypto.randomBytes, hashes it with
 * SHA-256, and inserts/updates the partner row. Prints the plaintext
 * key to stdout exactly ONCE — operator captures it, stores in
 * 1Password, and clears terminal scrollback. The plaintext is never
 * persisted to disk or the database.
 *
 * Run separately for staging and production:
 *   DATABASE_URL=$STAGING_DATABASE_URL pnpm tsx scripts/seed-catercow-partner.ts
 *   DATABASE_URL=$PROD_DATABASE_URL    pnpm tsx scripts/seed-catercow-partner.ts --confirm-prod
 *
 * Re-running rotates the key. The previous key stops working immediately
 * (modulo the 60s registry cache TTL).
 *
 * Webhook URL stays NULL until CaterCow provides one. When NULL, status
 * dispatchers log a "skipped" notice instead of erroring.
 */

import { createHash, randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });
config({ path: '.env.development.local' });
config({ path: '.env' });

const SLUG = 'catercow';
const DISPLAY_NAME = 'CaterCow';
const ORDER_PREFIX = 'CC-';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function generateApiKey(): string {
  // 32 bytes → 64 hex chars. Matches `openssl rand -hex 32`.
  return randomBytes(32).toString('hex');
}

function isProductionDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  return /prod|production/i.test(url) || /readyset.*\.supabase\.co/i.test(url);
}

async function main(): Promise<void> {
  if (isProductionDatabase() && !process.argv.includes('--confirm-prod')) {
    console.error('[seed-catercow-partner] DATABASE_URL looks like production. Pass --confirm-prod to proceed.');
    process.exit(1);
  }

  const apiKey = generateApiKey();
  const apiKeyHash = sha256Hex(apiKey);
  const apiKeyLastFour = apiKey.slice(-4);
  const env = isProductionDatabase() ? 'production' : 'staging-or-dev';

  const prisma = new PrismaClient();
  try {
    const row = await prisma.apiPartner.upsert({
      where: { slug: SLUG },
      update: {
        displayName: DISPLAY_NAME,
        orderPrefix: ORDER_PREFIX,
        apiKeyHash,
        apiKeyLastFour,
        // Intentionally leave webhookUrl/webhookSecret untouched on update —
        // those are configured separately via a future set-partner-webhook
        // helper once CaterCow provides their endpoint.
        isActive: true,
        deletedAt: null,
      },
      create: {
        slug: SLUG,
        displayName: DISPLAY_NAME,
        orderPrefix: ORDER_PREFIX,
        apiKeyHash,
        apiKeyLastFour,
        webhookUrl: null,
        webhookSecret: null,
        isActive: true,
      },
      select: { id: true, slug: true, apiKeyLastFour: true, isActive: true, webhookUrl: true },
    });

    const banner = '='.repeat(72);
    console.log(banner);
    console.log('CATERCOW API KEY — STORE IMMEDIATELY, THIS WILL NOT BE SHOWN AGAIN');
    console.log(banner);
    console.log(`env:    ${env}`);
    console.log(`slug:   ${row.slug}`);
    console.log(`last4:  ${row.apiKeyLastFour}`);
    console.log(`id:     ${row.id}`);
    console.log(`webhook URL configured: ${row.webhookUrl ? 'yes' : 'no (status callbacks will be skipped)'}`);
    console.log('');
    console.log('CATERCOW STAGING KEY:');
    console.log(apiKey);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Copy the key into 1Password: "Ready Set / Partner API Keys / CaterCow"');
    console.log('  2. Clear your terminal scrollback (Cmd+K on macOS Terminal/iTerm).');
    console.log('  3. Deliver to CaterCow via 1Password share link only.');
    console.log(banner);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-catercow-partner] Failed:', err);
  process.exit(1);
});
