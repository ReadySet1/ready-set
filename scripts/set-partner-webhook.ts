#!/usr/bin/env tsx
/**
 * Configure a partner's outbound status webhook (URL + HMAC secret).
 *
 * Sets `webhook_url` and `webhook_secret` on an existing api_partners
 * row. If no secret is supplied one is generated (256-bit, matching
 * `openssl rand -hex 32`) and printed to stdout exactly ONCE — operator
 * captures it, stores in 1Password, shares with the partner, and clears
 * terminal scrollback. The secret is the shared key the partner uses to
 * verify the `x-readyset-signature` header on each callback.
 *
 * The partner row must already exist (see seed-catercow-partner.ts).
 *
 * Usage:
 *   PARTNER_SLUG=catercow \
 *   WEBHOOK_URL=https://api.staging.steerdelivery.com/webhooks/ready_set \
 *   DATABASE_URL=$STAGING_DATABASE_URL \
 *     pnpm tsx scripts/set-partner-webhook.ts
 *
 *   # Reuse an existing secret instead of generating one:
 *   WEBHOOK_SECRET=<hex> ... pnpm tsx scripts/set-partner-webhook.ts
 *
 *   # Production requires an explicit flag:
 *   ... DATABASE_URL=$PROD_DATABASE_URL pnpm tsx scripts/set-partner-webhook.ts --confirm-prod
 */

import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });
config({ path: '.env.development.local' });
config({ path: '.env' });

function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

function isProductionDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  return /prod|production/i.test(url) || /readyset.*\.supabase\.co/i.test(url);
}

async function main(): Promise<void> {
  const slug = process.env.PARTNER_SLUG;
  const webhookUrl = process.env.WEBHOOK_URL;

  if (!slug) {
    console.error('[set-partner-webhook] PARTNER_SLUG is required.');
    process.exit(1);
  }
  if (!webhookUrl) {
    console.error('[set-partner-webhook] WEBHOOK_URL is required.');
    process.exit(1);
  }
  try {
    // Fail fast on obviously-malformed URLs before touching the DB.
    const parsed = new URL(webhookUrl);
    if (parsed.protocol !== 'https:') {
      console.error('[set-partner-webhook] WEBHOOK_URL must be https.');
      process.exit(1);
    }
  } catch {
    console.error(`[set-partner-webhook] WEBHOOK_URL is not a valid URL: ${webhookUrl}`);
    process.exit(1);
  }

  if (isProductionDatabase() && !process.argv.includes('--confirm-prod')) {
    console.error('[set-partner-webhook] DATABASE_URL looks like production. Pass --confirm-prod to proceed.');
    process.exit(1);
  }

  const providedSecret = process.env.WEBHOOK_SECRET?.trim();
  const secret = providedSecret && providedSecret.length > 0 ? providedSecret : generateSecret();
  const generated = !providedSecret;
  const env = isProductionDatabase() ? 'production' : 'staging-or-dev';

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.apiPartner.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      console.error(
        `[set-partner-webhook] No active api_partners row for slug "${slug}". ` +
          `Seed the partner first (e.g. scripts/seed-${slug}-partner.ts).`
      );
      process.exit(1);
    }

    const row = await prisma.apiPartner.update({
      where: { id: existing.id },
      data: { webhookUrl, webhookSecret: secret },
      select: { id: true, slug: true, webhookUrl: true },
    });

    const banner = '='.repeat(72);
    console.log(banner);
    console.log('PARTNER WEBHOOK CONFIGURED');
    console.log(banner);
    console.log(`env:         ${env}`);
    console.log(`slug:        ${row.slug}`);
    console.log(`id:          ${row.id}`);
    console.log(`webhook URL: ${row.webhookUrl}`);
    console.log(`secret:      ${generated ? 'generated (shown below)' : 'reused from WEBHOOK_SECRET (not shown)'}`);
    if (generated) {
      console.log('');
      console.log('HMAC SIGNING SECRET — STORE IMMEDIATELY, THIS WILL NOT BE SHOWN AGAIN:');
      console.log(secret);
      console.log('');
      console.log('Next steps:');
      console.log(`  1. Copy into 1Password: "Ready Set / Partner API Keys / ${row.slug} webhook secret"`);
      console.log('  2. Clear your terminal scrollback (Cmd+K on macOS Terminal/iTerm).');
      console.log('  3. Deliver to the partner via 1Password share link only.');
    }
    console.log(banner);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[set-partner-webhook] Failed:', err);
  process.exit(1);
});
