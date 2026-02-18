import { DriverStatus } from '@/types/user';
import {
  getTimestampUpdatesForStatus,
  getNextStatus,
  canTransitionTo,
  getStatusProgress,
  STATUS_ORDER,
} from '@/lib/delivery-status-transitions';

describe('getTimestampUpdatesForStatus', () => {
  it('should return arrived_at_vendor_at for ARRIVED_AT_VENDOR', () => {
    const updates = getTimestampUpdatesForStatus(DriverStatus.ARRIVED_AT_VENDOR);
    expect(updates).toEqual(['arrived_at_vendor_at = NOW()']);
  });

  it('should return picked_up_at and en_route_at for EN_ROUTE_TO_CLIENT', () => {
    const updates = getTimestampUpdatesForStatus(DriverStatus.EN_ROUTE_TO_CLIENT);
    expect(updates).toEqual(['picked_up_at = NOW()', 'en_route_at = NOW()']);
  });

  it('should return arrived_at_client_at for ARRIVED_TO_CLIENT', () => {
    const updates = getTimestampUpdatesForStatus(DriverStatus.ARRIVED_TO_CLIENT);
    expect(updates).toEqual(['arrived_at_client_at = NOW()']);
  });

  it('should return delivered_at for COMPLETED', () => {
    const updates = getTimestampUpdatesForStatus(DriverStatus.COMPLETED);
    expect(updates).toEqual(['delivered_at = NOW()']);
  });

  it('should return empty array for ASSIGNED (handled by assignDeliveryToDriver)', () => {
    const updates = getTimestampUpdatesForStatus(DriverStatus.ASSIGNED);
    expect(updates).toEqual([]);
  });

  it('should return empty array for unknown status', () => {
    const updates = getTimestampUpdatesForStatus('UNKNOWN_STATUS');
    expect(updates).toEqual([]);
  });

  it('should return timestamp updates for every status in STATUS_ORDER except ASSIGNED', () => {
    const statusesWithTimestamps = STATUS_ORDER.filter(
      (s) => s !== DriverStatus.ASSIGNED
    );
    for (const status of statusesWithTimestamps) {
      const updates = getTimestampUpdatesForStatus(status);
      expect(updates.length).toBeGreaterThan(0);
    }
  });
});

describe('delivery lifecycle timestamp coverage', () => {
  it('should produce timestamps for the full delivery lifecycle', () => {
    const allTimestampColumns: string[] = [];

    for (const status of STATUS_ORDER) {
      const updates = getTimestampUpdatesForStatus(status);
      for (const update of updates) {
        const column = update.split(' = ')[0];
        if (column) allTimestampColumns.push(column);
      }
    }

    // assigned_at is set by assignDeliveryToDriver, not this helper
    expect(allTimestampColumns).toContain('arrived_at_vendor_at');
    expect(allTimestampColumns).toContain('picked_up_at');
    expect(allTimestampColumns).toContain('en_route_at');
    expect(allTimestampColumns).toContain('arrived_at_client_at');
    expect(allTimestampColumns).toContain('delivered_at');
  });

  it('should follow the correct status order for transitions', () => {
    expect(STATUS_ORDER).toEqual([
      DriverStatus.ASSIGNED,
      DriverStatus.ARRIVED_AT_VENDOR,
      DriverStatus.EN_ROUTE_TO_CLIENT,
      DriverStatus.ARRIVED_TO_CLIENT,
      DriverStatus.COMPLETED,
    ]);
  });

  it('should allow sequential transitions through entire lifecycle', () => {
    let current: DriverStatus | null = null;

    for (const expectedNext of STATUS_ORDER) {
      const next = getNextStatus(current);
      expect(next).toBe(expectedNext);
      expect(canTransitionTo(current, expectedNext)).toBe(true);
      current = expectedNext;
    }

    // After COMPLETED, no more transitions
    expect(getNextStatus(current)).toBeNull();
  });

  it('should reach 100% progress at COMPLETED', () => {
    expect(getStatusProgress(DriverStatus.COMPLETED)).toBe(100);
    expect(getStatusProgress(DriverStatus.ASSIGNED)).toBe(0);
  });
});
