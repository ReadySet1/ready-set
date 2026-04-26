import { Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/prisma';

type Db = Prisma.TransactionClient | typeof defaultPrisma;

/**
 * The shape of a user's primary address as it appears in API responses
 * and form state. Mirrors the embedded `Profile.street1..zip` columns plus
 * the two facility fields the Address table also tracks.
 */
export type ProfileAddressFields = {
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  locationNumber: string | null;
  parkingLoading: string | null;
};

const EMPTY_ADDRESS: ProfileAddressFields = {
  street1: null,
  street2: null,
  city: null,
  state: null,
  zip: null,
  locationNumber: null,
  parkingLoading: null,
};

function hasAnyAddressContent(addr: Partial<ProfileAddressFields>): boolean {
  return Boolean(
    addr.street1 || addr.city || addr.state || addr.zip,
  );
}

/**
 * Resolves a profile's primary address.
 *
 * Resolution order:
 *   1. UserAddress(isDefault=true).address — the canonical source.
 *   2. Profile.street1..zip embedded fields — legacy fallback. If embedded
 *      data is present and no default address exists, lazy-backfill: create
 *      an Address row, link it via UserAddress(isDefault=true), and return
 *      the freshly-canonicalized address.
 *
 * Returns null only when the profile genuinely has no address recorded.
 */
export async function getProfileAddress(
  profileId: string,
  tx?: Db,
): Promise<ProfileAddressFields | null> {
  const db = tx ?? defaultPrisma;

  const defaultUA = await db.userAddress.findFirst({
    where: { userId: profileId, isDefault: true },
    include: { address: true },
  });
  if (defaultUA?.address) {
    return toFields(defaultUA.address);
  }

  // Fallback: read the embedded fields, and if they hold real data, backfill.
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      street1: true,
      street2: true,
      city: true,
      state: true,
      zip: true,
      locationNumber: true,
      parkingLoading: true,
    },
  });
  if (!profile) return null;

  const fields: ProfileAddressFields = {
    street1: profile.street1 ?? null,
    street2: profile.street2 ?? null,
    city: profile.city ?? null,
    state: profile.state ?? null,
    zip: profile.zip ?? null,
    locationNumber: profile.locationNumber ?? null,
    parkingLoading: profile.parkingLoading ?? null,
  };

  if (!hasAnyAddressContent(fields)) {
    return null;
  }

  // Lazy backfill: create the canonical row so future reads short-circuit.
  // The Address table requires non-null street1/city/state/zip, so we only
  // backfill when the embedded data is complete enough to satisfy that.
  if (fields.street1 && fields.city && fields.state && fields.zip) {
    await createDefaultUserAddress(db, profileId, fields);
  }

  return fields;
}

/**
 * Sets a profile's primary address. Updates the existing default UserAddress's
 * underlying Address row, or creates one if none exists.
 *
 * Never writes to the embedded `Profile.street1..zip` fields — those are
 * deprecated as of Phase 2 and remain only as a read fallback for legacy data.
 */
export async function setProfileAddress(
  profileId: string,
  addr: ProfileAddressFields,
  tx?: Db,
): Promise<void> {
  const db = tx ?? defaultPrisma;

  if (!addr.street1 || !addr.city || !addr.state || !addr.zip) {
    throw new Error(
      'setProfileAddress requires street1, city, state, and zip — Address columns are NOT NULL',
    );
  }

  const existing = await db.userAddress.findFirst({
    where: { userId: profileId, isDefault: true },
    select: { addressId: true },
  });

  if (existing) {
    await db.address.update({
      where: { id: existing.addressId },
      data: {
        street1: addr.street1,
        street2: addr.street2,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        locationNumber: addr.locationNumber,
        parkingLoading: addr.parkingLoading,
      },
    });
    return;
  }

  await createDefaultUserAddress(db, profileId, addr);
}

async function createDefaultUserAddress(
  db: Db,
  profileId: string,
  addr: ProfileAddressFields,
): Promise<void> {
  // Type guard above guarantees these are non-null when called from
  // setProfileAddress; the lazy-backfill caller checks the same condition.
  const created = await db.address.create({
    data: {
      street1: addr.street1!,
      street2: addr.street2,
      city: addr.city!,
      state: addr.state!,
      zip: addr.zip!,
      locationNumber: addr.locationNumber,
      parkingLoading: addr.parkingLoading,
      createdBy: profileId,
    },
  });
  await db.userAddress.create({
    data: {
      userId: profileId,
      addressId: created.id,
      isDefault: true,
      alias: 'Main Address',
    },
  });
}

function toFields(addr: {
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  locationNumber: string | null;
  parkingLoading: string | null;
}): ProfileAddressFields {
  return {
    street1: addr.street1,
    street2: addr.street2,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    locationNumber: addr.locationNumber,
    parkingLoading: addr.parkingLoading,
  };
}

export { EMPTY_ADDRESS };
