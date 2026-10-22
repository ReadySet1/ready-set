#!/usr/bin/env tsx
/**
 * Create (or repair) a dedicated driver login for a field tester or a real
 * pilot driver.
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
 * Usage (dev, the default):
 *   pnpm driver:account -- --email fernando.driver@readysetllc.com --name "Fernando (QA)"
 *
 * Usage (production — real pilot drivers only):
 *   pnpm driver:account:prod -- --confirm-prod jiasmmmmhtreoacdpiby \
 *     --email jane.driver@example.com --name "Jane Doe" [--reset-password] [--apply]
 *
 * Reports by default; writes only with --apply.
 *
 * Production mode is stricter than dev (see src/lib/driver/driver-account-plan.ts):
 *   - requires --prod AND --confirm-prod <ref>, and every connection URL must be prod;
 *   - never changes the role of an existing non-DRIVER profile;
 *   - never resets an existing user's password unless --reset-password is passed.
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import {
  findAuthUserByEmail,
  planAccountWrite,
  resolveAccountTarget,
  type AccountTarget,
} from '../src/lib/driver/driver-account-plan';

interface Args {
  email?: string;
  name?: string;
  password?: string;
  apply: boolean;
  prod: boolean;
  confirmProd?: string;
  resetPassword: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false, prod: false, resetPassword: false };
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
      case '--confirm-prod':
        args.confirmProd = value;
        i += 1;
        break;
      case '--apply':
        args.apply = true;
        break;
      case '--prod':
        args.prod = true;
        break;
      case '--reset-password':
        args.resetPassword = true;
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

/** The pooler runs in transaction mode and drops Prisma's prepared statements. */
function poolerUrl(raw: string): URL {
  const url = new URL(raw);
  url.searchParams.set('pgbouncer', 'true');
  url.searchParams.set('connection_limit', '1');
  return url;
}

const args = parseArgs(process.argv.slice(2));

// Decide the target BEFORE any client exists, so a refused environment never
// gets a connection.
const target: AccountTarget = resolveAccountTarget({
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  prod: args.prod,
  confirmProd: args.confirmProd,
});
const isProd = target === 'prod';

const dbUrl = poolerUrl(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ datasourceUrl: dbUrl.toString() });

function printProdBanner(supabaseHost: string) {
  const bar = '═'.repeat(60);
  console.log(`\n🚨 ${bar}`);
  console.log('🚨  PRODUCTION — this writes to the LIVE Ready Set project');
  console.log(`🚨  DB host       : ${dbUrl.host}`);
  console.log(`🚨  Supabase host : ${supabaseHost}`);
  console.log(`🚨 ${bar}\n`);
}

async function main() {
  if (!args.email) throw new Error('--email is required');
  if (!args.name) throw new Error('--name is required');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const supabaseHost = new URL(supabaseUrl).hostname;
  if (isProd) printProdBanner(supabaseHost);
  console.log(`🗄️  Database: ${dbUrl.host}`);
  console.log(`🗄️  Supabase: ${supabaseHost}`);
  console.log(
    `${args.apply ? '⚙️  APPLY' : '🔍 DRY RUN'}${isProd ? ' [PRODUCTION]' : ''} — driver account for ${args.email}\n`,
  );

  const authUser = await findAuthUserByEmail(async (page, perPage) => {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listing auth users: ${error.message}`);
    return { users: data.users };
  }, args.email);

  const profile = await prisma.profile.findFirst({
    where: { email: args.email },
    select: { id: true, type: true, status: true },
  });
  // The upsert below is keyed on the auth user id, which can be a different
  // profile than the email match. Both count for the role guard.
  const authProfile =
    authUser && authUser.id !== profile?.id
      ? await prisma.profile.findUnique({
          where: { id: authUser.id },
          select: { id: true, type: true, status: true },
        })
      : null;

  const driver = profile
    ? await prisma.driver.findFirst({
        where: { OR: [{ profileId: profile.id }, { userId: profile.id }] },
        select: { id: true, profileId: true, userId: true, deletedAt: true },
      })
    : null;

  console.log('📋 Current state');
  console.log(`   auth user : ${authUser ? authUser.id : 'missing'}`);
  console.log(`   profile   : ${profile ? `${profile.id} [${profile.type}/${profile.status}]` : 'missing'}`);
  if (authProfile) {
    console.log(`   auth profile: ${authProfile.id} [${authProfile.type}/${authProfile.status}]`);
  }
  console.log(`   driver row: ${driver ? driver.id : 'missing'}\n`);

  const existingTypes = [profile?.type, authProfile?.type].filter(
    (t): t is NonNullable<typeof t> => t != null,
  );
  const plan = planAccountWrite({
    target,
    authUserExists: authUser !== null,
    profileType: existingTypes.find((t) => t !== 'DRIVER') ?? existingTypes[0] ?? null,
    resetPassword: args.resetPassword,
  });
  console.log(`📝 Plan: ${authUser ? 'reuse' : 'create'} auth user; password ${plan.setPassword ? 'will be set' : 'unchanged'}\n`);

  if (!args.apply) {
    console.log('✋ Dry run — nothing written. Re-run with --apply.');
    return;
  }

  const password = plan.setPassword ? (args.password ?? generatePassword()) : null;

  // ------------------------------------------------------------- auth user
  let userId: string;
  if (authUser) {
    userId = authUser.id;
    if (password) {
      const { error } = await supabase.auth.admin.updateUserById(userId, { password });
      if (error) throw new Error(`updating auth user: ${error.message}`);
      console.log('   ✅ auth user password reset');
    } else {
      console.log('   ✅ auth user exists — password left unchanged');
    }
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: args.email,
      password: password as string,
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

  console.log(`\n🎉 Account ready${isProd ? ' on PRODUCTION' : ''}. Hand these to the driver:`);
  console.log(`   Email:    ${args.email}`);
  console.log(`   Password: ${password ?? '(unchanged)'}`);
  console.log(`   Driver:   ${driverRow.id}`);
  if (!isProd) {
    console.log(`\n   Prep a run with:`);
    console.log(`   pnpm test:drive:reset -- --driver ${args.email} --lat <lat> --lng <lng> --apply`);
  }
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
