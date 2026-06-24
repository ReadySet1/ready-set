/**
 * Regression test for getDriverDeliveryStats legacy-dispatch enum literals.
 *
 * Bug: the dispatch "completed" FILTER compared cr.status / od.status against
 * lowercase literals ('completed','delivered'). CateringStatus / OnDemandStatus
 * are UPPERCASE Postgres enums, so the lowercase comparison threw 22P02
 * (invalid input value for enum) and the whole stats query failed.
 *
 * Fix: the literals are now UPPERCASE ('COMPLETED','DELIVERED'). This test
 * inspects the SQL actually sent to Prisma to lock that in.
 */

const mockQueryRawUnsafe = jest.fn();

jest.mock('@/utils/prismaDB', () => ({
  prisma: { $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args) },
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

import { getDriverDeliveryStats } from '../driver-stats';

const DRIVER_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('getDriverDeliveryStats — dispatch enum literals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes('FROM deliveries')) {
        return Promise.resolve([
          { total: BigInt(0), completed: BigInt(0), cancelled: BigInt(0), in_progress: BigInt(0) },
        ]);
      }
      if (sql.includes('SELECT profile_id FROM drivers')) {
        return Promise.resolve([{ profile_id: 'profile-123' }]);
      }
      if (sql.includes('FROM dispatches')) {
        return Promise.resolve([{ total: BigInt(2), completed: BigInt(2) }]);
      }
      return Promise.resolve([]);
    });
  });

  it('compares dispatch order status against UPPERCASE enum literals', async () => {
    await getDriverDeliveryStats(DRIVER_ID, new Date('2024-01-01'), new Date('2024-01-31'));

    const dispatchCall = mockQueryRawUnsafe.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('FROM dispatches'),
    );
    expect(dispatchCall).toBeDefined();
    const sql = dispatchCall![0] as string;

    // The fix: UPPERCASE literals matching the Postgres enum.
    expect(sql).toContain("cr.status IN ('COMPLETED', 'DELIVERED')");
    expect(sql).toContain("od.status IN ('COMPLETED', 'DELIVERED')");
    // The bug: lowercase literals must be gone (they caused 22P02).
    expect(sql).not.toContain("'completed'");
    expect(sql).not.toContain("'delivered'");
  });

  it('combines legacy dispatch completions into the totals', async () => {
    const stats = await getDriverDeliveryStats(
      DRIVER_ID,
      new Date('2024-01-01'),
      new Date('2024-01-31'),
    );
    // 0 from the new deliveries system + 2 from legacy dispatches.
    expect(stats.total).toBe(2);
    expect(stats.completed).toBe(2);
  });
});
