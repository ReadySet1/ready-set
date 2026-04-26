/**
 * Lifecycle parity test for Phase 2 address consolidation.
 *
 * Substitutes for organic dev soak (no users yet) by simulating the full
 * profile lifecycle — register, edit settings, fetch — through the
 * profile address helper, and asserting the canonical Address row stays
 * in sync with whatever the user last submitted.
 *
 * Pre-Phase-2 bug: settings updates wrote only to the embedded Profile
 * fields, leaving the parallel Address row stale. This test fails if
 * that drift ever returns.
 */

import { getProfileAddress, setProfileAddress } from '../address';

type Address = {
  id: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  locationNumber: string | null;
  parkingLoading: string | null;
  createdBy: string | null;
};

type UserAddress = {
  id: string;
  userId: string;
  addressId: string;
  isDefault: boolean;
  alias?: string | null;
};

type Profile = {
  id: string;
  street1: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  locationNumber: string | null;
  parkingLoading: string | null;
};

function makeFakeDb() {
  const profiles: Profile[] = [];
  const addresses: Address[] = [];
  const userAddresses: UserAddress[] = [];
  let nextId = 1;
  const id = () => `gen-${nextId++}`;

  const db = {
    profile: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        profiles.find((p) => p.id === where.id) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Partial<Profile> & { id?: string } }) => {
        const created: Profile = {
          id: data.id ?? id(),
          street1: data.street1 ?? null,
          street2: data.street2 ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          zip: data.zip ?? null,
          locationNumber: data.locationNumber ?? null,
          parkingLoading: data.parkingLoading ?? null,
        };
        profiles.push(created);
        return created;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Profile> }) => {
        const idx = profiles.findIndex((p) => p.id === where.id);
        if (idx < 0) throw new Error('Profile not found');
        profiles[idx] = { ...profiles[idx]!, ...data };
        return profiles[idx]!;
      }),
    },
    userAddress: {
      findFirst: jest.fn(
        async ({
          where,
          include,
        }: {
          where: { userId: string; isDefault?: boolean };
          include?: { address?: boolean };
        }) => {
          const ua = userAddresses.find(
            (u) =>
              u.userId === where.userId &&
              (where.isDefault === undefined || u.isDefault === where.isDefault),
          );
          if (!ua) return null;
          if (include?.address) {
            const addr = addresses.find((a) => a.id === ua.addressId);
            return { ...ua, address: addr };
          }
          return ua;
        },
      ),
      create: jest.fn(async ({ data }: { data: Omit<UserAddress, 'id'> }) => {
        const created: UserAddress = { id: id(), ...data };
        userAddresses.push(created);
        return created;
      }),
    },
    address: {
      create: jest.fn(async ({ data }: { data: Omit<Address, 'id'> }) => {
        const created: Address = {
          id: id(),
          street2: null,
          locationNumber: null,
          parkingLoading: null,
          createdBy: null,
          ...data,
        };
        addresses.push(created);
        return created;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Omit<Address, 'id'>>;
        }) => {
          const idx = addresses.findIndex((a) => a.id === where.id);
          if (idx < 0) throw new Error('Address not found');
          addresses[idx] = { ...addresses[idx]!, ...data } as Address;
          return addresses[idx]!;
        },
      ),
    },
  };

  return { db, profiles, addresses, userAddresses };
}

describe('Profile address lifecycle parity', () => {
  it('register → fetch → update → fetch keeps Address row canonical', async () => {
    const { db, profiles, addresses, userAddresses } = makeFakeDb();

    // 1. Register: simulate registration creating Profile + Address + UserAddress.
    //    This mirrors what /api/register/route.ts does today.
    profiles.push({
      id: 'user-1',
      street1: '100 Original Way',
      street2: null,
      city: 'OldCity',
      state: 'CA',
      zip: '94000',
      locationNumber: null,
      parkingLoading: null,
    });
    addresses.push({
      id: 'addr-1',
      street1: '100 Original Way',
      street2: null,
      city: 'OldCity',
      state: 'CA',
      zip: '94000',
      locationNumber: null,
      parkingLoading: null,
      createdBy: 'user-1',
    });
    userAddresses.push({
      id: 'ua-1',
      userId: 'user-1',
      addressId: 'addr-1',
      isDefault: true,
      alias: 'Main Address',
    });

    // 2. Fetch: getProfileAddress returns the canonical row, not the embedded.
    const initial = await getProfileAddress('user-1', db as any);
    expect(initial?.street1).toBe('100 Original Way');

    // 3. Settings update: user changes their address via the profile page.
    //    This is the path that previously skipped the Address table.
    await setProfileAddress(
      'user-1',
      {
        street1: '200 Updated Blvd',
        street2: 'Apt 7',
        city: 'NewCity',
        state: 'TX',
        zip: '75001',
        locationNumber: 'B-12',
        parkingLoading: 'rear lot',
      },
      db as any,
    );

    // 4. Fetch again: the canonical row reflects the user's last input.
    const afterUpdate = await getProfileAddress('user-1', db as any);
    expect(afterUpdate).toEqual({
      street1: '200 Updated Blvd',
      street2: 'Apt 7',
      city: 'NewCity',
      state: 'TX',
      zip: '75001',
      locationNumber: 'B-12',
      parkingLoading: 'rear lot',
    });

    // 5. Bug-regression guards:
    //    a) Only one Address row exists for this user (no duplicate created).
    expect(addresses.filter((a) => a.createdBy === 'user-1')).toHaveLength(1);
    //    b) The original UserAddress row was reused (not replaced).
    expect(userAddresses.filter((u) => u.userId === 'user-1')).toHaveLength(1);
    expect(userAddresses[0]?.id).toBe('ua-1');
    //    c) The Address row was updated in place.
    expect(addresses[0]?.id).toBe('addr-1');
    expect(addresses[0]?.street1).toBe('200 Updated Blvd');
  });

  it('legacy profile (no UserAddress yet) backfills on first read, then updates work normally', async () => {
    const { db, addresses, userAddresses } = makeFakeDb();

    // Legacy state: profile exists with embedded fields, but no Address row.
    // Reproduces a user created before the Address table existed.
    db.profile.findUnique = jest.fn(async () => ({
      id: 'legacy-user',
      street1: '300 Legacy Ln',
      street2: null,
      city: 'LegacyTown',
      state: 'NY',
      zip: '10001',
      locationNumber: null,
      parkingLoading: null,
    })) as any;

    // First read backfills.
    const first = await getProfileAddress('legacy-user', db as any);
    expect(first?.street1).toBe('300 Legacy Ln');
    expect(addresses).toHaveLength(1);
    expect(userAddresses).toHaveLength(1);
    expect(userAddresses[0]?.isDefault).toBe(true);

    // Subsequent update writes to the (now-existing) canonical row, not embedded.
    await setProfileAddress(
      'legacy-user',
      {
        street1: '400 Modern Ave',
        street2: null,
        city: 'Modern',
        state: 'NY',
        zip: '10002',
        locationNumber: null,
        parkingLoading: null,
      },
      db as any,
    );

    expect(addresses).toHaveLength(1);
    expect(addresses[0]?.street1).toBe('400 Modern Ave');
  });
});
