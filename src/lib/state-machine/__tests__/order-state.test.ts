import { CateringStatus } from '@/types/user';
import {
  ORDER_TRANSITIONS,
  canTransitionOrder,
  assertOrderTransition,
  isTerminalOrderStatus,
} from '../order-state';
import { StateTransitionError } from '../types';

describe('canTransitionOrder', () => {
  it('allows null → PENDING and null → ACTIVE', () => {
    expect(canTransitionOrder(null, CateringStatus.PENDING)).toBe(true);
    expect(canTransitionOrder(null, CateringStatus.ACTIVE)).toBe(true);
  });

  it('rejects null → any other status', () => {
    expect(canTransitionOrder(null, CateringStatus.ASSIGNED)).toBe(false);
    expect(canTransitionOrder(null, CateringStatus.IN_PROGRESS)).toBe(false);
    expect(canTransitionOrder(null, CateringStatus.COMPLETED)).toBe(false);
  });

  it('honors the transition graph for happy path', () => {
    expect(canTransitionOrder(CateringStatus.PENDING, CateringStatus.CONFIRMED)).toBe(true);
    expect(canTransitionOrder(CateringStatus.CONFIRMED, CateringStatus.ASSIGNED)).toBe(true);
    expect(canTransitionOrder(CateringStatus.ASSIGNED, CateringStatus.IN_PROGRESS)).toBe(true);
    expect(canTransitionOrder(CateringStatus.IN_PROGRESS, CateringStatus.DELIVERED)).toBe(true);
    expect(canTransitionOrder(CateringStatus.DELIVERED, CateringStatus.COMPLETED)).toBe(true);
  });

  it('allows CANCELLED from any non-terminal state', () => {
    const cancellable = [
      CateringStatus.PENDING,
      CateringStatus.CONFIRMED,
      CateringStatus.ACTIVE,
      CateringStatus.ASSIGNED,
      CateringStatus.IN_PROGRESS,
    ];
    for (const from of cancellable) {
      expect(canTransitionOrder(from, CateringStatus.CANCELLED)).toBe(true);
    }
  });

  it('rejects transitions out of terminal states', () => {
    expect(canTransitionOrder(CateringStatus.COMPLETED, CateringStatus.PENDING)).toBe(false);
    expect(canTransitionOrder(CateringStatus.CANCELLED, CateringStatus.ASSIGNED)).toBe(false);
  });

  it('rejects skipping required states', () => {
    // PENDING cannot jump straight to IN_PROGRESS
    expect(canTransitionOrder(CateringStatus.PENDING, CateringStatus.IN_PROGRESS)).toBe(false);
    // CONFIRMED cannot jump straight to DELIVERED
    expect(canTransitionOrder(CateringStatus.CONFIRMED, CateringStatus.DELIVERED)).toBe(false);
  });
});

describe('assertOrderTransition', () => {
  it('returns void on legal transition', () => {
    expect(() => assertOrderTransition(CateringStatus.PENDING, CateringStatus.CONFIRMED)).not.toThrow();
  });

  it('throws StateTransitionError on illegal transition', () => {
    expect(() => assertOrderTransition(CateringStatus.COMPLETED, CateringStatus.PENDING))
      .toThrow(StateTransitionError);
  });

  it('error includes from, to, and kind', () => {
    try {
      assertOrderTransition(CateringStatus.COMPLETED, CateringStatus.PENDING);
      fail('expected throw');
    } catch (e) {
      const err = e as StateTransitionError;
      expect(err.from).toBe(CateringStatus.COMPLETED);
      expect(err.to).toBe(CateringStatus.PENDING);
      expect(err.kind).toBe('order');
    }
  });
});

describe('isTerminalOrderStatus', () => {
  it('reports COMPLETED and CANCELLED as terminal', () => {
    expect(isTerminalOrderStatus(CateringStatus.COMPLETED)).toBe(true);
    expect(isTerminalOrderStatus(CateringStatus.CANCELLED)).toBe(true);
  });

  it('reports non-terminal states correctly', () => {
    expect(isTerminalOrderStatus(CateringStatus.PENDING)).toBe(false);
    expect(isTerminalOrderStatus(CateringStatus.IN_PROGRESS)).toBe(false);
    expect(isTerminalOrderStatus(CateringStatus.DELIVERED)).toBe(false);
  });
});

describe('ORDER_TRANSITIONS graph snapshot', () => {
  it('matches expected shape — guard against accidental edits', () => {
    expect(ORDER_TRANSITIONS).toMatchSnapshot();
  });
});
