#!/usr/bin/env tsx
/**
 * Create (or repair) a dedicated driver login for a field tester.
 *
 * Per-tester accounts are the point. A shared driver login is how one person's
 * abandoned run becomes another person's blocked shift — see
 * docs/testing/field-test-drive-runbook.md and the 2026-08-06 field run.
 *
 * Unlike scripts/create-test-users.ts, this also creates the `drivers` row.
 * A DRIVER profile without one cannot use the tracking portal at all: driver
 * ownership resolves through drivers.profile_id / drivers.user_id
 * (src/lib/auth/driver-ownership.ts), not through the profile alone.
 *
 * Usage:
 *   pnpm driver:account -- --email fernando.driver@readysetllc.com --name "Fernando (QA)"
 *
 * Reports by default; writes only with --apply.
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';

/** Supabase ref of the production project. Never a target for this script. */
const PROD_PROJECT_REF = 'jiasmmmmhtreoacdpiby';

interface Args {
  email?: string;
  name?: string;
  password?: string;
  apply: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i + 1];
    switch (argv[i]) {
      case '--email':
        args.email = value;
        i += 1;
        break;
      case '--name':
        args.name = value;
        i += 1;
        break;
      case '--password':
        args.password = value;
        i += 1;
        break;
      case '--apply':
        args.apply = true;
        break;
      default:
        break;
    }
  }
  return args;
}

/** Readable but strong enough to hand to someone over chat. */
function generatePassword(): string {
  return `Drive-${randomBytes(6).toString('base64url')}-26`;
}

function resolveConnectionUrl(): string {
  const raw = process.env.DATABASE_URL || '';
  if (!raw) throw new Error('DATABASE_URL is not set — run through `dotenv -e .env.local --`.');
  for (const candidate of [process.env.DATABASE_URL, process.env.DIRECT_URL]) {
    if (candidate?.includes(PROD_PROJECT_REF)) {
      throw new Error(
        'Connection points at the PRODUCTION Supabase project. This script only runs against dev.',
      );
    }
  }
  // The pooler runs in transaction mode and drops Prisma's prepared statements.
  const url = new URL(raw);
  url.searchParams.set('pgbouncer', 'true');
  url.searchParams.set('connection_limit', '1');
  console.log(`🗄️  Database: ${url.host}`);
  return url.toString();
}

const prisma = new PrismaClient({ datasourceUrl: resolveConnectionUrl() });

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.email) throw new Error('--email is required');
  if (!args.name) throw new Error('--name is required');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required');
  }
  if (supabaseUrl.includes(PROD_PROJECT_REF)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL points at production. Dev only.');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`🗄️  Supabase: ${new URL(supabaseUrl).hostname}`);
  console.log(`${args.apply ? '⚙️  APPLY' : '🔍 DRY RUN'} — driver account for ${args.email}\n`);

  const { data: existing } = await supabase.auth.admin.listUsers();
  const authUser = existing?.users?.find(
    (u) => u.email?.toLowerCase() === args.email!.toLowerCase(),
  );

  const profile = await prisma.profile.findFirst({
    where: { email: args.email },
    select: { id: true, type: true, status: true },
  });

  const driver = profile
    ? await prisma.driver.findFirst({
        where: { OR: [{ profileId: profile.id }, { userId: profile.id }] },
        select: { id: true, profileId: true, userId: true, deletedAt: true },
      })
    : null;

  console.log('📋 Current state');
  console.log(`   auth user : ${authUser ? authUser.id : 'missing'}`);
  console.log(`   profile   : ${profile ? `${profile.id} [${profile.type}/${profile.status}]` : 'missing'}`);
  console.log(`   driver row: ${driver ? driver.id : 'missing'}\n`);

  if (!args.apply) {
    console.log('✋ Dry run — nothing written. Re-run with --apply.');
    return;
  }

  const password = args.password ?? generatePassword();

  // ------------------------------------------------------------- auth user
  let userId: string;
  if (authUser) {
    userId = authUser.id;
    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(`updating auth user: ${error.message}`);
    console.log('   ✅ auth user password reset');
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: args.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: args.name },
    });
    if (error || !data.user) throw new Error(`creating auth user: ${error?.message}`);
    userId = data.user.id;
    console.log(`   ✅ auth user created ${userId}`);
  }

  // --------------------------------------------------------------- profile
  await prisma.profile.upsert({
    where: { id: userId },
    update: { email: args.email, name: args.name, type: 'DRIVER', status: 'ACTIVE', deletedAt: null },
    create: { id: userId, email: args.email, name: args.name, type: 'DRIVER', status: 'ACTIVE' },
  });
  console.log('   ✅ profile ready [DRIVER/ACTIVE]');

  // ------------------------------------------------------------ driver row
  // Both link columns are written. Ownership checks accept either, and leaving
  // one null is what makes a driver invisible to half the codebase.
  const existingDriver = await prisma.driver.findFirst({
    where: { OR: [{ profileId: userId }, { userId }] },
    select: { id: true },
  });

  const driverRow = existingDriver
    ? await prisma.driver.update({
        where: { id: existingDriver.id },
        data: { profileId: userId, userId, isActive: true, deletedAt: null },
        select: { id: true },
      })
    : await prisma.driver.create({
        data: { profileId: userId, userId, isActive: true },
        select: { id: true },
      });
  console.log(`   ✅ driver row ready ${driverRow.id}`);

  console.log('\n🎉 Account ready. Hand these to the tester:');
  console.log(`   Email:    ${args.email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Driver:   ${driverRow.id}`);
  console.log(`\n   Prep a run with:`);
  console.log(`   pnpm test:drive:reset -- --driver ${args.email} --lat <lat> --lng <lng> --apply`);
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
