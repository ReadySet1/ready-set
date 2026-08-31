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
 *   --route <key>       Named route preset with real geocoded stops
 *                       (mutually exclusive with --lat/--lng/--city)
 *   --leg am|pm         Which route leg to seed (default: picked by local time)
 *   --run-id <id>       Order-number suffix (default: UTC timestamp)
 *   --lead <minutes>    Minutes from now until the scheduled pickup (default 30)
 *   --window <minutes>  Minutes allowed between pickup and arrival (default 30)
 *   --no-seed           Clean up only, do not create a new order
 *   --force             Also clear orders that are NOT recognisably synthetic
 *   --apply             Perform the writes (otherwise dry run)
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import {
  TEST_DRIVE_ROUTES,
  TEST_ORDER_PREFIX,
  buildRouteTestDrivePlan,
  buildTestDrivePlan,
  isDisposableTestOrder,
  type Coords,
  type RouteStop,
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
  route?: string;
  leg?: 'am' | 'pm';
  runId?: string;
  pickupDistanceM?: number;
  leadMinutes?: number;
  windowMinutes?: number;
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
      case '--route':
        args.route = value?.toLowerCase();
        i += 1;
        break;
      case '--leg':
        if (value !== 'am' && value !== 'pm') {
          throw new Error(`--leg must be am or pm, got ${value ?? '(nothing)'}`);
        }
        args.leg = value;
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
      case '--lead':
        args.leadMinutes = Number(value);
        i += 1;
        break;
      case '--window':
        args.windowMinutes = Number(value);
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
 * Both seeding modes converge on RouteStop-shaped pickup/dropoff stops so the
 * address writes go through one find-or-create path instead of minting new
 * rows on every run (rs-dev accumulated 25 duplicated street+city keys that
 * way, 96% of them without coordinates).
 */
interface SeedPlan {
  orderNumber: string;
  pickup: RouteStop;
  dropoff: RouteStop;
  pickupAt: Date;
  arriveBy: Date;
}

/**
 * Reuse the oldest active address row matching the stop's street1 + city, or
 * create one with the full stop data. Rows found without coordinates get the
 * stop's coords backfilled — most historical seed rows were never geocoded.
 */
async function findOrCreateAddress(tx: Prisma.TransactionClient, stop: RouteStop): Promise<string> {
  const existing = await tx.address.findFirst({
    where: { street1: stop.street1, city: stop.city, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, latitude: true },
  });

  if (existing) {
    if (existing.latitude === null) {
      await tx.address.update({
        where: { id: existing.id },
        data: { latitude: stop.coords.lat, longitude: stop.coords.lng },
      });
      console.log(`   ♻️  reused address "${stop.street1}" (coords backfilled)`);
    } else {
      console.log(`   ♻️  reused address "${stop.street1}"`);
    }
    return existing.id;
  }

  const created = await tx.address.create({
    data: {
      street1: stop.street1,
      city: stop.city,
      state: stop.state,
      zip: stop.zip,
      latitude: stop.coords.lat,
      longitude: stop.coords.lng,
      ...(stop.isRestaurant ? { isRestaurant: true } : {}),
    },
    select: { id: true },
  });
  console.log(`   ➕ created address "${stop.street1}"`);
  return created.id;
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
  const route = args.route ? TEST_DRIVE_ROUTES[args.route] : undefined;
  if (args.route && !route) {
    throw new Error(
      `Unknown --route ${args.route}. Known: ${Object.keys(TEST_DRIVE_ROUTES).join(', ')}`,
    );
  }
  if (route && (args.lat !== undefined || args.lng !== undefined || args.city !== undefined)) {
    throw new Error('--route and --lat/--lng/--city are mutually exclusive — pick one');
  }

  const preset = args.city ? CITY_PRESETS[args.city] : undefined;
  if (args.city && !preset) {
    throw new Error(`Unknown --city ${args.city}. Known: ${Object.keys(CITY_PRESETS).join(', ')}`);
  }
  const origin: Coords | null = Number.isFinite(args.lat) && Number.isFinite(args.lng)
    ? { lat: args.lat as number, lng: args.lng as number }
    : preset
      ? { lat: preset.lat, lng: preset.lng }
      : null;

  if (!args.noSeed && !origin && !route) {
    throw new Error('Seeding needs a start point: pass --route, --lat/--lng, or --city');
  }

  const runId = args.runId ?? defaultRunId(now);
  let seed: SeedPlan | null = null;
  let startHint: string | null = null;

  if (args.noSeed) {
    // Cleanup-only run: an origin or route on the command line does not seed.
  } else if (route) {
    const plan = buildRouteTestDrivePlan({
      route,
      runId,
      now,
      ...(args.leg ? { leg: args.leg } : {}),
      ...(Number.isFinite(args.leadMinutes) ? { leadMinutes: args.leadMinutes } : {}),
      ...(Number.isFinite(args.windowMinutes) ? { windowMinutes: args.windowMinutes } : {}),
    });
    seed = {
      orderNumber: plan.orderNumber,
      pickup: plan.pickup,
      dropoff: plan.dropoff,
      pickupAt: plan.pickupAt,
      arriveBy: plan.arriveBy,
    };
    startHint = plan.startHint;
    console.log(`🌱 Will seed ${plan.orderNumber} (${plan.leg} leg — start from ${plan.startHint})`);
    console.log(`   pickup  ${plan.pickup.street1} · ${plan.pickup.coords.lat.toFixed(6)}, ${plan.pickup.coords.lng.toFixed(6)}`);
    console.log(`   dropoff ${plan.dropoff.street1} · ${plan.dropoff.coords.lat.toFixed(6)}, ${plan.dropoff.coords.lng.toFixed(6)}`);
    console.log(`   pickup at ${plan.pickupAt.toISOString()} · arrive by ${plan.arriveBy.toISOString()}\n`);
  } else if (origin) {
    const plan = buildTestDrivePlan({
      origin,
      runId,
      now,
      ...(Number.isFinite(args.pickupDistanceM) ? { pickupDistanceM: args.pickupDistanceM } : {}),
      ...(Number.isFinite(args.leadMinutes) ? { leadMinutes: args.leadMinutes } : {}),
      ...(Number.isFinite(args.windowMinutes) ? { windowMinutes: args.windowMinutes } : {}),
      ...(Number.isFinite(args.dropoffDistanceM)
        ? { dropoffDistanceM: args.dropoffDistanceM }
        : {}),
    });
    // Pin mode reuses the preset's postal fields as before; the generated
    // labels double as street1, so repeated runs at the same distance dedupe.
    const geo = preset ?? { city: 'Test City', state: 'NA', zip: '00000' };
    seed = {
      orderNumber: plan.orderNumber,
      pickup: {
        label: plan.pickup.label,
        street1: plan.pickup.label,
        city: geo.city,
        state: geo.state,
        zip: geo.zip,
        coords: plan.pickup.coords,
        isRestaurant: true,
      },
      dropoff: {
        label: plan.dropoff.label,
        street1: plan.dropoff.label,
        city: geo.city,
        state: geo.state,
        zip: geo.zip,
        coords: plan.dropoff.coords,
      },
      pickupAt: plan.pickupAt,
      arriveBy: plan.arriveBy,
    };
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

    if (!seed) return;

    const client = await tx.profile.findFirst({
      where: { type: 'CLIENT', deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!client) throw new Error('No CLIENT profile available to own the seeded order');

    const pickupAddressId = await findOrCreateAddress(tx, seed.pickup);
    const deliveryAddressId = await findOrCreateAddress(tx, seed.dropoff);

    const order = await tx.cateringRequest.create({
      data: {
        userId: client.id,
        orderNumber: seed.orderNumber,
        pickupAddressId,
        deliveryAddressId,
        pickupDateTime: seed.pickupAt,
        arrivalDateTime: seed.arriveBy,
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

    console.log(`   ✅ seeded ${seed.orderNumber}`);
  });

  console.log(`\n🎉 ${args.driver} is clean and ready.`);
  if (seed) {
    console.log(`   Order: ${seed.orderNumber}`);
    if (startHint) {
      console.log(`   Tell the tester to start from ${startHint}.`);
    } else {
      console.log(`   Tell the tester to start their shift standing at the origin, then walk north.`);
    }
  }
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
