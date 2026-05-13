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

/**
 * In-memory fake of the slice of Prisma the helper touches. Lets us assert on
 * exact CRUD calls without spinning up a DB.
 */
function makeFakeDb(seed: {
  profiles?: Profile[];
  addresses?: Address[];
  userAddresses?: UserAddress[];
}) {
  const profiles = [...(seed.profiles ?? [])];
  const addresses = [...(seed.addresses ?? [])];
  const userAddresses = [...(seed.userAddresses ?? [])];

  let nextId = 1;
  const id = () => `gen-${nextId++}`;

  const db = {
    profile: {
      findUnique: jest.fn(async ({ where }: { where: { id: string }; select?: unknown }) => {
        return profiles.find((p) => p.id === where.id) ?? null;
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
      create: jest.fn(async ({ data }: { data: Omit<Address, 'id'> & { street1: string } }) => {
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
          const existing = addresses[idx]!;
          const merged: Address = {
            ...existing,
            ...data,
          } as Address;
          addresses[idx] = merged;
          return merged;
        },
      ),
    },
  };

  return { db, profiles, addresses, userAddresses };
}

describe('getProfileAddress', () => {
  it('returns the canonical Address when a default UserAddress exists', async () => {
    const { db } = makeFakeDb({
      profiles: [
        { id: 'p1', street1: 'STALE', street2: null, city: 'STALE', state: 'STALE', zip: 'STALE', locationNumber: null, parkingLoading: null },
      ],
      addresses: [
        { id: 'a1', street1: '100 Real St', street2: null, city: 'Real City', state: 'CA', zip: '94000', locationNumber: 'B', parkingLoading: 'rear', createdBy: 'p1' },
      ],
      userAddresses: [
        { id: 'ua1', userId: 'p1', addressId: 'a1', isDefault: true },
      ],
    });

    const res = await getProfileAddress('p1', db as any);

    expect(res).toEqual({
      street1: '100 Real St',
      street2: null,
      city: 'Real City',
      state: 'CA',
      zip: '94000',
      locationNumber: 'B',
      parkingLoading: 'rear',
    });
    // Embedded-fields read should not have happened.
    expect(db.profile.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to embedded fields when no default UserAddress exists', async () => {
    const { db } = makeFakeDb({
      profiles: [
        { id: 'p1', street1: '200 Old Way', street2: null, city: 'Old', state: 'NY', zip: '10001', locationNumber: null, parkingLoading: null },
      ],
    });

    const res = await getProfileAddress('p1', db as any);

    expect(res?.street1).toBe('200 Old Way');
    expect(res?.city).toBe('Old');
  });

  it('lazy-backfills the canonical Address when embedded data is complete', async () => {
    const { db, addresses, userAddresses } = makeFakeDb({
      profiles: [
        { id: 'p1', street1: '300 Backfill Rd', street2: 'Apt 2', city: 'BFC', state: 'CA', zip: '90000', locationNumber: null, parkingLoading: null },
      ],
    });

    await getProfileAddress('p1', db as any);

    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatchObject({
      street1: '300 Backfill Rd',
      city: 'BFC',
      state: 'CA',
      zip: '90000',
      createdBy: 'p1',
    });
    expect(userAddresses).toHaveLength(1);
    expect(userAddresses[0]).toMatchObject({
      userId: 'p1',
      addressId: addresses[0]!.id,
      isDefault: true,
    });
  });

  it('does NOT backfill when embedded data is incomplete', async () => {
    const { db, addresses, userAddresses } = makeFakeDb({
      profiles: [
        // street1 only — missing city/state/zip; Address NOT NULL constraint would fail.
        { id: 'p1', street1: '400 Lonely Ln', street2: null, city: null, state: null, zip: null, locationNumber: null, parkingLoading: null },
      ],
    });

    const res = await getProfileAddress('p1', db as any);

    expect(res?.street1).toBe('400 Lonely Ln');
    expect(addresses).toHaveLength(0);
    expect(userAddresses).toHaveLength(0);
  });

  it('returns null when the profile has no address at all', async () => {
    const { db } = makeFakeDb({
      profiles: [
        { id: 'p1', street1: null, street2: null, city: null, state: null, zip: null, locationNumber: null, parkingLoading: null },
      ],
    });

    const res = await getProfileAddress('p1', db as any);

    expect(res).toBeNull();
  });

  it('returns null when the profile does not exist', async () => {
    const { db } = makeFakeDb({});
    const res = await getProfileAddress('missing', db as any);
    expect(res).toBeNull();
  });
});

describe('setProfileAddress', () => {
  it('updates the existing default Address row when one exists', async () => {
    const { db, addresses } = makeFakeDb({
      addresses: [
        { id: 'a1', street1: 'Old', street2: null, city: 'Old', state: 'NY', zip: '00000', locationNumber: null, parkingLoading: null, createdBy: 'p1' },
      ],
      userAddresses: [
        { id: 'ua1', userId: 'p1', addressId: 'a1', isDefault: true },
      ],
    });

    await setProfileAddress(
      'p1',
      {
        street1: '500 New Pl',
        street2: null,
        city: 'NewCity',
        state: 'CA',
        zip: '94001',
        locationNumber: null,
        parkingLoading: null,
      },
      db as any,
    );

    expect(db.address.update).toHaveBeenCalledTimes(1);
    expect(db.address.create).not.toHaveBeenCalled();
    expect(db.userAddress.create).not.toHaveBeenCalled();
    expect(addresses[0]).toMatchObject({
      id: 'a1',
      street1: '500 New Pl',
      city: 'NewCity',
      state: 'CA',
      zip: '94001',
    });
  });

  it('creates Address + default UserAddress when none exists', async () => {
    const { db, addresses, userAddresses } = makeFakeDb({});

    await setProfileAddress(
      'p1',
      {
        street1: '600 Brand New Way',
        street2: 'Suite A',
        city: 'NewTown',
        state: 'TX',
        zip: '75001',
        locationNumber: null,
        parkingLoading: null,
      },
      db as any,
    );

    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatchObject({
      street1: '600 Brand New Way',
      street2: 'Suite A',
      createdBy: 'p1',
    });
    expect(userAddresses).toHaveLength(1);
    expect(userAddresses[0]).toMatchObject({
      userId: 'p1',
      addressId: addresses[0]!.id,
      isDefault: true,
      alias: 'Main Address',
    });
  });

  it('throws when required fields are missing — Address NOT NULL constraint', async () => {
    const { db } = makeFakeDb({});

    await expect(
      setProfileAddress(
        'p1',
        {
          street1: null,
          street2: null,
          city: 'X',
          state: 'X',
          zip: 'X',
          locationNumber: null,
          parkingLoading: null,
        },
        db as any,
      ),
    ).rejects.toThrow(/street1, city, state, and zip/);
  });
});
