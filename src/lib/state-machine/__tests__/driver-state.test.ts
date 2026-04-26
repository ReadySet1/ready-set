import { CateringStatus, DriverStatus } from '@/types/user';
import {
  DRIVER_TRANSITIONS,
  DRIVER_TO_ORDER,
  canTransitionDriver,
  assertDriverTransition,
  deriveOrderStatusFromDriver,
  shouldNotifyAdmin,
  shouldNotifyCustomer,
} from '../driver-state';
import { StateTransitionError } from '../types';

describe('canTransitionDriver', () => {
  it('allows null → ASSIGNED only', () => {
    expect(canTransitionDriver(null, DriverStatus.ASSIGNED)).toBe(true);
    expect(canTransitionDriver(null, DriverStatus.PICKED_UP)).toBe(false);
    expect(canTransitionDriver(null, DriverStatus.COMPLETED)).toBe(false);
  });

  it('allows ASSIGNED → EN_ROUTE_TO_VENDOR or ARRIVED_AT_VENDOR', () => {
    expect(canTransitionDriver(DriverStatus.ASSIGNED, DriverStatus.EN_ROUTE_TO_VENDOR)).toBe(true);
    expect(canTransitionDriver(DriverStatus.ASSIGNED, DriverStatus.ARRIVED_AT_VENDOR)).toBe(true);
  });

  it('allows skipping EN_ROUTE_TO_CLIENT (preserved historical behavior)', () => {
    expect(canTransitionDriver(DriverStatus.ARRIVED_AT_VENDOR, DriverStatus.EN_ROUTE_TO_CLIENT)).toBe(true);
  });

  it('allows early COMPLETED from any non-terminal state', () => {
    const states: (DriverStatus | null)[] = [
      DriverStatus.ASSIGNED,
      DriverStatus.EN_ROUTE_TO_VENDOR,
      DriverStatus.ARRIVED_AT_VENDOR,
      DriverStatus.PICKED_UP,
      DriverStatus.EN_ROUTE_TO_CLIENT,
      DriverStatus.ARRIVED_TO_CLIENT,
    ];
    for (const from of states) {
      expect(canTransitionDriver(from, DriverStatus.COMPLETED)).toBe(true);
    }
  });

  it('rejects backwards transitions', () => {
    expect(canTransitionDriver(DriverStatus.PICKED_UP, DriverStatus.ASSIGNED)).toBe(false);
    expect(canTransitionDriver(DriverStatus.ARRIVED_AT_VENDOR, DriverStatus.EN_ROUTE_TO_VENDOR)).toBe(false);
  });

  it('rejects all transitions out of COMPLETED', () => {
    for (const to of Object.values(DriverStatus)) {
      expect(canTransitionDriver(DriverStatus.COMPLETED, to)).toBe(false);
    }
  });
});

describe('assertDriverTransition', () => {
  it('throws StateTransitionError on illegal transition', () => {
    expect(() => assertDriverTransition(DriverStatus.PICKED_UP, DriverStatus.ASSIGNED))
      .toThrow(StateTransitionError);
  });

  it('does not throw on legal transition', () => {
    expect(() => assertDriverTransition(null, DriverStatus.ASSIGNED)).not.toThrow();
  });
});

describe('deriveOrderStatusFromDriver', () => {
  it('maps in-progress driver states to IN_PROGRESS order status', () => {
    expect(deriveOrderStatusFromDriver(DriverStatus.EN_ROUTE_TO_VENDOR)).toBe(CateringStatus.IN_PROGRESS);
    expect(deriveOrderStatusFromDriver(DriverStatus.ARRIVED_AT_VENDOR)).toBe(CateringStatus.IN_PROGRESS);
    expect(deriveOrderStatusFromDriver(DriverStatus.PICKED_UP)).toBe(CateringStatus.IN_PROGRESS);
    expect(deriveOrderStatusFromDriver(DriverStatus.EN_ROUTE_TO_CLIENT)).toBe(CateringStatus.IN_PROGRESS);
    expect(deriveOrderStatusFromDriver(DriverStatus.ARRIVED_TO_CLIENT)).toBe(CateringStatus.IN_PROGRESS);
  });

  it('maps COMPLETED to COMPLETED', () => {
    expect(deriveOrderStatusFromDriver(DriverStatus.COMPLETED)).toBe(CateringStatus.COMPLETED);
  });

  it('returns null for ASSIGNED — order ASSIGNED is owned by assignDriver flow', () => {
    expect(deriveOrderStatusFromDriver(DriverStatus.ASSIGNED)).toBe(null);
  });
});

describe('notification triggers', () => {
  it('shouldNotifyCustomer: all in-progress + COMPLETED', () => {
    expect(shouldNotifyCustomer(DriverStatus.EN_ROUTE_TO_VENDOR)).toBe(true);
    expect(shouldNotifyCustomer(DriverStatus.ARRIVED_AT_VENDOR)).toBe(true);
    expect(shouldNotifyCustomer(DriverStatus.EN_ROUTE_TO_CLIENT)).toBe(true);
    expect(shouldNotifyCustomer(DriverStatus.ARRIVED_TO_CLIENT)).toBe(true);
    expect(shouldNotifyCustomer(DriverStatus.COMPLETED)).toBe(true);
  });

  it('shouldNotifyCustomer: not for ASSIGNED or PICKED_UP', () => {
    expect(shouldNotifyCustomer(DriverStatus.ASSIGNED)).toBe(false);
    expect(shouldNotifyCustomer(DriverStatus.PICKED_UP)).toBe(false);
  });

  it('shouldNotifyAdmin: only COMPLETED', () => {
    expect(shouldNotifyAdmin(DriverStatus.COMPLETED)).toBe(true);
    expect(shouldNotifyAdmin(DriverStatus.ASSIGNED)).toBe(false);
    expect(shouldNotifyAdmin(DriverStatus.PICKED_UP)).toBe(false);
  });
});

describe('graph snapshots', () => {
  it('DRIVER_TRANSITIONS matches expected shape', () => {
    expect(DRIVER_TRANSITIONS).toMatchSnapshot();
  });

  it('DRIVER_TO_ORDER matches expected shape', () => {
    expect(DRIVER_TO_ORDER).toMatchSnapshot();
  });
});
