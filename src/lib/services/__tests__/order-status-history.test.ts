/**
 * Tests for the driver-transition audit trail (order_status_history).
 *
 * - shouldRecordDriverHistory: only non-partner catering orders get driver
 *   rows (partner orders' history is the partner-facing contract log).
 * - recordDriverStatusTransition: one INSERT on the global client, never throws.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: { orderStatusHistory: { create: jest.fn() } },
}));
jest.mock('@/lib/services/partner-registry', () => ({
  getPartnerByOrderNumber: jest.fn(),
}));
jest.mock('@/lib/logging/realtime-logger', () => ({
  realtimeLogger: { error: jest.fn() },
}));

import { DriverStatus } from '@/types/user';
import { prisma } from '@/utils/prismaDB';
import { getPartnerByOrderNumber } from '@/lib/services/partner-registry';
import { realtimeLogger } from '@/lib/logging/realtime-logger';
import {
  recordDriverStatusTransition,
  shouldRecordDriverHistory,
} from '../order-status-history';

const mockedGetPartner = jest.mocked(getPartnerByOrderNumber);
const mockedCreate = prisma.orderStatusHistory.create as jest.Mock;
const mockedLogError = jest.mocked(realtimeLogger.error);

beforeEach(() => jest.clearAllMocks());

describe('shouldRecordDriverHistory', () => {
  it('is true for a non-partner catering order', async () => {
    mockedGetPartner.mockResolvedValue(null);
    await expect(shouldRecordDriverHistory('catering', 'RSQA-1')).resolves.toBe(true);
    expect(mockedGetPartner).toHaveBeenCalledWith('RSQA-1');
  });

  it('is false for a registry partner order', async () => {
    mockedGetPartner.mockResolvedValue({ slug: 'catercow' } as any);
    await expect(shouldRecordDriverHistory('catering', 'CC-1')).resolves.toBe(false);
  });

  it('is false for on-demand orders (the table FKs to catering_requests)', async () => {
    await expect(shouldRecordDriverHistory('on_demand', 'OD-1')).resolves.toBe(false);
    expect(mockedGetPartner).not.toHaveBeenCalled();
  });

  it('is false (and never throws) when the partner lookup fails', async () => {
    mockedGetPartner.mockRejectedValue(new Error('db down'));
    await expect(shouldRecordDriverHistory('catering', 'RSQA-1')).resolves.toBe(false);
    expect(mockedLogError).toHaveBeenCalled();
  });
});

describe('recordDriverStatusTransition', () => {
  it('inserts one row with the right fields', async () => {
    mockedCreate.mockResolvedValue({ id: 'h-1' });
    const ok = await recordDriverStatusTransition({
      cateringRequestId: 'order-1',
      driverStatus: DriverStatus.ARRIVED_AT_VENDOR,
      partnerStatus: 'IN_PROGRESS',
      changedBy: 'profile-1',
      location: { lat: 37.7, lng: -122.4 },
    });

    expect(ok).toBe(true);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith({
      data: {
        cateringRequestId: 'order-1',
        driverStatus: DriverStatus.ARRIVED_AT_VENDOR,
        partnerStatus: 'IN_PROGRESS',
        changedBy: 'profile-1',
        location: { lat: 37.7, lng: -122.4 },
        notes: 'driver:ARRIVED_AT_VENDOR',
      },
    });
  });

  it('omits location when none is known', async () => {
    mockedCreate.mockResolvedValue({ id: 'h-1' });
    await recordDriverStatusTransition({
      cateringRequestId: 'order-1',
      driverStatus: DriverStatus.COMPLETED,
      partnerStatus: 'COMPLETED',
      changedBy: null,
    });
    const data = mockedCreate.mock.calls[0][0].data;
    expect(data.location).toBeUndefined();
    expect(data.changedBy).toBeNull();
  });

  it('logs and returns false (never throws) when the insert fails', async () => {
    mockedCreate.mockRejectedValue(new Error('insert failed'));
    await expect(
      recordDriverStatusTransition({
        cateringRequestId: 'order-1',
        driverStatus: DriverStatus.PICKED_UP,
        partnerStatus: 'IN_PROGRESS',
        changedBy: 'profile-1',
      }),
    ).resolves.toBe(false);
    expect(mockedLogError).toHaveBeenCalledWith(
      expect.stringContaining('failed to record driver transition'),
      expect.objectContaining({ metadata: expect.objectContaining({ cateringRequestId: 'order-1' }) }),
    );
  });
});
