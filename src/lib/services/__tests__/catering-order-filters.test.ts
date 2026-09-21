/**
 * Catering status-tab filters (old-orders audit, 2026-09-14).
 *
 * The admin order tabs used to be an if/else chain inside the route handler,
 * so the status groupings were untestable. They now live here, together with
 * the new "Overdue" grouping that puts a date bound on open orders.
 */

import {
  buildCateringStatusTabWhere,
  OPEN_CATERING_STATUSES,
  OVERDUE_GRACE_HOURS,
} from '../catering-order-filters';
import { CateringStatus } from '@/types/prisma';

describe('buildCateringStatusTabWhere', () => {
  const now = new Date('2026-09-21T12:00:00.000Z');

  it('returns null for an unknown or missing tab so the caller can fall back', () => {
    expect(buildCateringStatusTabWhere(null, now)).toBeNull();
    expect(buildCateringStatusTabWhere('', now)).toBeNull();
    expect(buildCateringStatusTabWhere('nonsense', now)).toBeNull();
  });

  it('maps all_open to every non-terminal status with no date bound', () => {
    const where = buildCateringStatusTabWhere('all_open', now);

    expect(where).toEqual({ status: { in: [...OPEN_CATERING_STATUSES] } });
    expect(where).not.toHaveProperty('pickupDateTime');
  });

  it('maps new to the statuses awaiting processing', () => {
    expect(buildCateringStatusTabWhere('new', now)).toEqual({
      status: { in: [CateringStatus.PENDING, CateringStatus.CONFIRMED] },
    });
  });

  it('maps in_transit to the statuses being worked on', () => {
    expect(buildCateringStatusTabWhere('in_transit', now)).toEqual({
      status: {
        in: [
          CateringStatus.ACTIVE,
          CateringStatus.ASSIGNED,
          CateringStatus.IN_PROGRESS,
          CateringStatus.DELIVERED,
        ],
      },
    });
  });

  it('maps the legacy active tab to its original status set', () => {
    expect(buildCateringStatusTabWhere('active', now)).toEqual({
      status: {
        in: [
          CateringStatus.ACTIVE,
          CateringStatus.ASSIGNED,
          CateringStatus.PENDING,
          CateringStatus.CONFIRMED,
          CateringStatus.IN_PROGRESS,
        ],
      },
    });
  });

  describe('overdue', () => {
    it('keeps open orders whose pickup time is past the grace window', () => {
      const where = buildCateringStatusTabWhere('overdue', now);

      expect(where).toEqual({
        status: { in: [...OPEN_CATERING_STATUSES] },
        pickupDateTime: {
          lt: new Date(now.getTime() - OVERDUE_GRACE_HOURS * 60 * 60 * 1000),
        },
      });
    });

    it('uses a cutoff strictly in the past so same-day deliveries stay out', () => {
      const where = buildCateringStatusTabWhere('overdue', now);
      const cutoff = (where as { pickupDateTime: { lt: Date } }).pickupDateTime.lt;

      expect(cutoff.getTime()).toBeLessThan(now.getTime());
    });

    it('never includes terminal statuses', () => {
      const where = buildCateringStatusTabWhere('overdue', now) as {
        status: { in: string[] };
      };

      expect(where.status.in).not.toContain(CateringStatus.COMPLETED);
      expect(where.status.in).not.toContain(CateringStatus.CANCELLED);
    });

    it('defaults to the current time when no clock is supplied', () => {
      const before = Date.now();
      const where = buildCateringStatusTabWhere('overdue') as {
        pickupDateTime: { lt: Date };
      };
      const after = Date.now();
      const graceMs = OVERDUE_GRACE_HOURS * 60 * 60 * 1000;

      expect(where.pickupDateTime.lt.getTime()).toBeGreaterThanOrEqual(before - graceMs);
      expect(where.pickupDateTime.lt.getTime()).toBeLessThanOrEqual(after - graceMs);
    });
  });
});
