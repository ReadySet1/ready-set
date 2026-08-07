#!/usr/bin/env tsx
/**
 * Reset a driver's test state and seed a fresh field test drive at the
 * tester's own location.
 *
 * Why this exists
 * ---------------
 * The 2026-08-06 walking run lost its shift to two June seed orders pinned to
 * Mexico City while the tester stood in León. 198 mi outside the arrival
 * geofence, they could neither advance nor dismiss those orders, and the
 * end-shift guard (src/app/actions/tracking/driver-actions.ts) refused to
 * close the shift. There is no driver-facing escape hatch — only an admin can
 * force it — so the run ended with a shift that could not be closed.
 *
 * Two lessons are baked in here:
 *  1. Stops must be generated relative to where the tester actually stands.
 *  2. The account must be verifiably clean BEFORE the shift starts, because
 *     an overdue ASSIGNED order blocks end-shift even if nobody touches it.
 *
 * Usage
 * -----
 *   pnpm test:drive:reset -- --driver driver.test@example.com --lat 21.1219 --lng -101.6833
 *
 * Reports only by default. Add --apply to actually write.
 *
 *   --driver <email>    Driver's login email (required)
 *   --lat/--lng         Where the tester will start (required unless --no-seed)
 *   --city <preset>     Convenience preset instead of --lat/--lng
 *   --run-id <id>       Order-number suffix (default: UTC timestamp)
 *   --no-seed           Clean up only, do not create a new order
 *   --force             Also clear orders that are NOT recognisably synthetic
 *   --apply             Perform the writes (otherwise dry run)
 */

import { PrismaClient } from '@prisma/client';
import {
  TEST_ORDER_PREFIX,
  buildTestDrivePlan,
  isDisposableTestOrder,
  type Coords,
} from '../src/lib/driver/test-drive-plan';

/** Supabase ref of the production project. Never a target for this script. */
const PROD_PROJECT_REF = 'jiasmmmmhtreoacdpiby';

/** Convenience start points for the cities the team tests from. */
const CITY_PRESETS: Record<string, Coords & { city: string; state: string; zip: string }> = {
  leon: { lat: 21.1219, lng: -101.6833, city: 'León', state: 'GTO', zip: '37000' },
  cdmx: { lat: 19.4326, lng: -99.1332, city: 'Ciudad de México', state: 'CDMX', zip: '06000' },
  sf: { lat: 37.7749, lng: -122.4194, city: 'San Francisco', state: 'CA', zip: '94103' },
};

interface Args {
  driver?: string;
  lat?: number;
  lng?: number;
  city?: string;
  runId?: string;
  pickupDistanceM?: number;
  dropoffDistanceM?: number;
  noSeed: boolean;
  force: boolean;
  apply: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { noSeed: false, force: false, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--driver':
        args.driver = value;
        i += 1;
        break;
      case '--lat':
        args.lat = Number(value);
        i += 1;
        break;
      case '--lng':
        args.lng = Number(value);
        i += 1;
        break;
      case '--city':
        args.city = value?.toLowerCase();
        i += 1;
        break;
      case '--run-id':
        args.runId = value;
        i += 1;
        break;
      case '--pickup-distance':
        args.pickupDistanceM = Number(value);
        i += 1;
        break;
      case '--dropoff-distance':
        args.dropoffDistanceM = Number(value);
        i += 1;
        break;
      case '--no-seed':
        args.noSeed = true;
        break;
      case '--force':
        args.force = true;
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

function defaultRunId(now: Date): string {
  const iso = now.toISOString();
  return `${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 13)}${iso.slice(14, 16)}`;
}

/**
 * Connect through DATABASE_URL. That is the Supabase pooler in transaction
 * mode, which does not keep the prepared statements Prisma opens by default
 * ("prepared statement s3 does not exist"), so `pgbouncer=true` is forced on.
 *
 * DIRECT_URL is deliberately not preferred here: the direct host resolves to
 * IPv6 only and is unreachable from most networks the team works on.
 */
function resolveConnectionUrl(): string {
  const raw = process.env.DATABASE_URL || '';
  if (!raw) {
    throw new Error('DATABASE_URL is not set — run through `dotenv -e .env.local --`.');
  }

  // Check every configured URL, so a mismatched pair can never sneak a
  // production write through.
  for (const candidate of [process.env.DATABASE_URL, process.env.DIRECT_URL]) {
    if (candidate?.includes(PROD_PROJECT_REF)) {
      throw new Error(
        'Connection points at the PRODUCTION Supabase project. This script only runs against dev.',
      );
    }
  }

  const url = new URL(raw);
  url.searchParams.set('pgbouncer', 'true');
  url.searchParams.set('connection_limit', '1');
  console.log(`🗄️  Database host: ${url.hostname}`);
  return url.toString();
}

const prisma = new PrismaClient({ datasourceUrl: resolveConnectionUrl() });

/** Non-terminal delivery statuses, matching the end-shift guard's first branch. */
const TERMINAL_DELIVERY_STATUSES = ['COMPLETED', 'CANCELLED', 'DELIVERED'];

/** driverStatus values that mean "in flight", matching the guard's second branch. */
const IN_FLIGHT_DRIVER_STATUSES = [
  'EN_ROUTE_TO_VENDOR',
  'ARRIVED_AT_VENDOR',
  'PICKED_UP',
  'EN_ROUTE_TO_CLIENT',
  'ARRIVED_TO_CLIENT',
] as const;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();

  if (!args.driver) {
    throw new Error('--driver <email> is required');
  }

  // Connection resolution and the production guard both run at import time,
  // in resolveConnectionUrl().
  console.log(`${args.apply ? '⚙️  APPLY' : '🔍 DRY RUN'} — reset test drive for ${args.driver}\n`);

  // ---------------------------------------------------------------- resolve
  const profile = await prisma.profile.findFirst({
    where: { email: args.driver, deletedAt: null },
    select: { id: true, name: true, email: true, type: true },
  });
  if (!profile) throw new Error(`No profile found for ${args.driver}`);

  // Ownership can hang off either column — see src/lib/auth/driver-ownership.ts.
  const driver = await prisma.driver.findFirst({
    where: { deletedAt: null, OR: [{ profileId: profile.id }, { userId: profile.id }] },
    select: { id: true, profileId: true, userId: true },
  });
  if (!driver) throw new Error(`No driver row linked to ${args.driver}`);

  console.log(`👤 ${profile.name ?? '(no name)'} <${profile.email}> [${profile.type}]`);
  console.log(`   driver ${driver.id} · profile ${profile.id}\n`);

  // ------------------------------------------------------------- inspect
  const staleDeliveries = await prisma.delivery.findMany({
    where: {
      driverId: driver.id,
      deletedAt: null,
      status: { notIn: TERMINAL_DELIVERY_STATUSES },
    },
    select: { id: true, orderNumber: true, status: true, createdAt: true },
  });

  const dispatches = await prisma.dispatch.findMany({
    where: { driverId: driver.profileId ?? driver.userId ?? profile.id },
    select: {
      id: true,
      cateringRequest: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          driverStatus: true,
          pickupDateTime: true,
          deletedAt: true,
        },
      },
      onDemand: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          driverStatus: true,
          pickupDateTime: true,
          deletedAt: true,
        },
      },
    },
  });

  // An order blocks end-shift if it is in flight, or ASSIGNED with a pickup
  // that is already due. Future-dated assignments are harmless.
  const blockingOrders = dispatches
    .map((d) => ({ dispatchId: d.id, order: d.cateringRequest ?? d.onDemand }))
    .filter((row): row is { dispatchId: string; order: NonNullable<typeof row.order> } => {
      const o = row.order;
      if (!o || o.deletedAt) return false;
      if (o.driverStatus && (IN_FLIGHT_DRIVER_STATUSES as readonly string[]).includes(o.driverStatus)) {
        return true;
      }
      return o.driverStatus === 'ASSIGNED' && o.pickupDateTime !== null && o.pickupDateTime <= now;
    });

  const openShifts = await prisma.driverShift.findMany({
    where: { driverId: driver.id, deletedAt: null, shiftEnd: null },
    select: { id: true, shiftStart: true, status: true },
  });

  console.log(`📋 Current state`);
  console.log(`   ${staleDeliveries.length} non-terminal delivery row(s)`);
  for (const d of staleDeliveries) {
    console.log(`     · ${d.orderNumber ?? d.id} — ${d.status}`);
  }
  console.log(`   ${blockingOrders.length} order(s) blocking end-shift`);
  for (const { order } of blockingOrders) {
    console.log(
      `     · ${order.orderNumber} — ${order.driverStatus} · pickup ${order.pickupDateTime?.toISOString() ?? 'n/a'}`,
    );
  }
  console.log(`   ${openShifts.length} open shift(s)`);
  for (const s of openShifts) {
    console.log(`     · ${s.id} — ${s.status} since ${s.shiftStart.toISOString()}`);
  }
  console.log('');

  // ------------------------------------------------------------- classify
  const risky = [
    ...staleDeliveries.filter((d) => !isDisposableTestOrder(d.orderNumber)).map((d) => d.orderNumber ?? d.id),
    ...blockingOrders.filter(({ order }) => !isDisposableTestOrder(order.orderNumber)).map(({ order }) => order.orderNumber),
  ];

  if (risky.length > 0 && !args.force) {
    console.error(`🛑 These do not look like generated test data:\n`);
    for (const label of risky) console.error(`     · ${label}`);
    console.error(
      `\n   Refusing to clear them. Re-run with --force if this really is a test account.`,
    );
    process.exitCode = 1;
    return;
  }

  // ---------------------------------------------------------------- plan
  const preset = args.city ? CITY_PRESETS[args.city] : undefined;
  if (args.city && !preset) {
    throw new Error(`Unknown --city ${args.city}. Known: ${Object.keys(CITY_PRESETS).join(', ')}`);
  }
  const origin: Coords | null = Number.isFinite(args.lat) && Number.isFinite(args.lng)
    ? { lat: args.lat as number, lng: args.lng as number }
    : preset
      ? { lat: preset.lat, lng: preset.lng }
      : null;

  if (!args.noSeed && !origin) {
    throw new Error('Seeding needs a start point: pass --lat/--lng or --city');
  }

  const plan = origin
    ? buildTestDrivePlan({
        origin,
        runId: args.runId ?? defaultRunId(now),
        now,
        ...(Number.isFinite(args.pickupDistanceM) ? { pickupDistanceM: args.pickupDistanceM } : {}),
        ...(Number.isFinite(args.dropoffDistanceM)
          ? { dropoffDistanceM: args.dropoffDistanceM }
          : {}),
      })
    : null;

  if (plan) {
    console.log(`🌱 Will seed ${plan.orderNumber}`);
    console.log(`   pickup  ${plan.pickup.coords.lat.toFixed(6)}, ${plan.pickup.coords.lng.toFixed(6)}`);
    console.log(`   dropoff ${plan.dropoff.coords.lat.toFixed(6)}, ${plan.dropoff.coords.lng.toFixed(6)}`);
    console.log(`   pickup at ${plan.pickupAt.toISOString()} · arrive by ${plan.arriveBy.toISOString()}\n`);
  }

  if (!args.apply) {
    console.log('✋ Dry run — nothing written. Re-run with --apply to perform this.');
    return;
  }

  // --------------------------------------------------------------- apply
  await prisma.$transaction(async (tx) => {
    if (staleDeliveries.length > 0) {
      await tx.delivery.updateMany({
        where: { id: { in: staleDeliveries.map((d) => d.id) } },
        data: { status: 'CANCELLED', cancelledAt: now, deletedAt: now },
      });
      console.log(`   ✅ cancelled ${staleDeliveries.length} delivery row(s)`);
    }

    // Removing the dispatch unassigns the order from the driver without
    // touching the order itself — the guard and the Track list are both keyed
    // on dispatches, so this clears the card cleanly.
    const dispatchIds = blockingOrders.map((b) => b.dispatchId);
    if (dispatchIds.length > 0) {
      await tx.dispatch.deleteMany({ where: { id: { in: dispatchIds } } });
      console.log(`   ✅ unassigned ${dispatchIds.length} order(s)`);
    }

    if (openShifts.length > 0) {
      await tx.driverShift.updateMany({
        where: { id: { in: openShifts.map((s) => s.id) } },
        data: { status: 'completed', shiftEnd: now },
      });
      console.log(`   ✅ closed ${openShifts.length} open shift(s)`);
    }

    if (!plan || !origin) return;

    const geo = preset ?? { city: 'Test City', state: 'NA', zip: '00000' };
    const client = await tx.profile.findFirst({
      where: { type: 'CLIENT', deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!client) throw new Error('No CLIENT profile available to own the seeded order');

    const pickupAddress = await tx.address.create({
      data: {
        street1: plan.pickup.label,
        city: geo.city,
        state: geo.state,
        zip: geo.zip,
        latitude: plan.pickup.coords.lat,
        longitude: plan.pickup.coords.lng,
        isRestaurant: true,
      },
      select: { id: true },
    });

    const deliveryAddress = await tx.address.create({
      data: {
        street1: plan.dropoff.label,
        city: geo.city,
        state: geo.state,
        zip: geo.zip,
        latitude: plan.dropoff.coords.lat,
        longitude: plan.dropoff.coords.lng,
      },
      select: { id: true },
    });

    const order = await tx.cateringRequest.create({
      data: {
        userId: client.id,
        orderNumber: plan.orderNumber,
        pickupAddressId: pickupAddress.id,
        deliveryAddressId: deliveryAddress.id,
        pickupDateTime: plan.pickupAt,
        arrivalDateTime: plan.arriveBy,
        status: 'ASSIGNED',
        driverStatus: 'ASSIGNED',
        headcount: 5,
        orderTotal: 100.0,
      },
      select: { id: true },
    });

    await tx.dispatch.create({
      data: {
        cateringRequestId: order.id,
        driverId: driver.profileId ?? driver.userId ?? profile.id,
      },
    });

    console.log(`   ✅ seeded ${plan.orderNumber}`);
  });

  console.log(`\n🎉 ${args.driver} is clean and ready.`);
  if (plan) {
    console.log(`   Order: ${plan.orderNumber}`);
    console.log(`   Tell the tester to start their shift standing at the origin, then walk north.`);
  }
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
