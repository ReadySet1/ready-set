jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { ensureAddress } from '../address-utils';

function makeExecutor() {
  return {
    address: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'addr-1' }),
    },
  };
}

const location = {
  name: 'Linden Office',
  address: '110 Linden Av',
  city: 'South San Francisco',
  state: 'California',
  zip: '94080',
};

describe('ensureAddress — state normalization', () => {
  it('looks up and stores the USPS code when the partner sends a full state name', async () => {
    const executor = makeExecutor();

    await ensureAddress(location, executor as any);

    expect(executor.address.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ state: 'CA' }) }),
    );
    expect(executor.address.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'CA' }) }),
    );
  });

  it('keeps a non-US region as sent', async () => {
    const executor = makeExecutor();

    await ensureAddress({ ...location, state: 'Guanajuato' }, executor as any);

    expect(executor.address.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'Guanajuato' }) }),
    );
  });
});
