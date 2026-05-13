#!/usr/bin/env tsx
/**
 * Seed the CaterValley row in api_partners.
 *
 * Reads CATERVALLEY_API_KEY (and optionally CATERVALLEY_WEBHOOK_URL) from
 * the environment, computes its SHA-256 hash, and upserts the row
 * keyed by slug. Idempotent: re-running with the same env values is a
 * no-op.
 *
 * The plaintext key value is stored in `webhookSecret` because today's
 * outbound HMAC signing uses CATERVALLEY_API_KEY as the shared secret
 * (see src/app/api/test/catervalley-webhook/route.ts). Once CaterValley
 * rotates to a separate webhook secret, run this script with
 * CATERVALLEY_WEBHOOK_SECRET set to override.
 *
 * Run on each environment after `prisma migrate deploy`:
 *   DATABASE_URL=$STAGING_DATABASE_URL pnpm tsx scripts/seed-catervalley-partner.ts
 *   DATABASE_URL=$PROD_DATABASE_URL    pnpm tsx scripts/seed-catervalley-partner.ts
 */

import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });
config({ path: '.env.development.local' });
config({ path: '.env' });

const SLUG = 'catervalley';
const DISPLAY_NAME = 'CaterValley';
const ORDER_PREFIX = 'CV-';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function main(): Promise<void> {
  const apiKey = process.env.CATERVALLEY_API_KEY;
  if (!apiKey) {
    console.error('CATERVALLEY_API_KEY is not set. Aborting — refusing to seed an unauthenticated row.');
    process.exit(1);
  }

  const webhookUrl = process.env.CATERVALLEY_WEBHOOK_URL ?? null;
  const webhookSecret = process.env.CATERVALLEY_WEBHOOK_SECRET ?? apiKey;

  const apiKeyHash = sha256Hex(apiKey);
  const apiKeyLastFour = apiKey.slice(-4);

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.apiPartner.findUnique({ where: { slug: SLUG } });

    if (existing && existing.apiKeyHash === apiKeyHash && existing.webhookSecret === webhookSecret && existing.webhookUrl === webhookUrl) {
      console.log(`[seed-catervalley-partner] Row already up to date (slug=${SLUG}, last4=${apiKeyLastFour}). No changes.`);
      return;
    }

    const row = await prisma.apiPartner.upsert({
      where: { slug: SLUG },
      update: {
        displayName: DISPLAY_NAME,
        orderPrefix: ORDER_PREFIX,
        apiKeyHash,
        apiKeyLastFour,
        webhookUrl,
        webhookSecret,
        isActive: true,
        deletedAt: null,
      },
      create: {
        slug: SLUG,
        displayName: DISPLAY_NAME,
        orderPrefix: ORDER_PREFIX,
        apiKeyHash,
        apiKeyLastFour,
        webhookUrl,
        webhookSecret,
        isActive: true,
      },
      select: { id: true, slug: true, apiKeyLastFour: true, isActive: true },
    });

    console.log(`[seed-catervalley-partner] Upserted row id=${row.id} slug=${row.slug} last4=${row.apiKeyLastFour} active=${row.isActive}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-catervalley-partner] Failed:', err);
  process.exit(1);
});
