import { CateringStatus, DriverStatus } from '@/types/user';
import { transitionOrder } from '../transition';
import { StateTransitionError } from '../types';

type UpdateCall = { where: { id: string }; data: Record<string, unknown> };

function makeFakeTx() {
  const cateringCalls: UpdateCall[] = [];
  const onDemandCalls: UpdateCall[] = [];
  const tx = {
    cateringRequest: {
      update: async (args: UpdateCall) => {
        cateringCalls.push(args);
        return args;
      },
    },
    onDemand: {
      update: async (args: UpdateCall) => {
        onDemandCalls.push(args);
        return args;
      },
    },
  };
  return { tx: tx as unknown as Parameters<typeof transitionOrder>[1], cateringCalls, onDemandCalls };
}

describe('transitionOrder — happy paths', () => {
  it('writes ASSIGNED via explicit nextOrderStatus override (assignDriver flow)', async () => {
    const { tx, cateringCalls } = makeFakeTx();

    const res = await transitionOrder(
      {
        orderType: 'catering',
        orderId: 'order-1',
        currentStatus: CateringStatus.CONFIRMED,
        currentDriverStatus: null,
        nextOrderStatus: CateringStatus.ASSIGNED,
      },
      tx,
    );

    expect(cateringCalls).toHaveLength(1);
    expect(cateringCalls[0]?.data.status).toBe(CateringStatus.ASSIGNED);
    expect(cateringCalls[0]?.data.driverStatus).toBeUndefined();
    expect(res.newStatus).toBe(CateringStatus.ASSIGNED);
    expect(res.previousStatus).toBe(CateringStatus.CONFIRMED);
  });

  it('derives IN_PROGRESS from EN_ROUTE_TO_VENDOR (driverStatus flow)', async () => {
    const { tx, cateringCalls } = makeFakeTx();

    const res = await transitionOrder(
      {
        orderType: 'catering',
        orderId: 'order-2',
        currentStatus: CateringStatus.ASSIGNED,
        currentDriverStatus: DriverStatus.ASSIGNED,
        nextDriverStatus: DriverStatus.EN_ROUTE_TO_VENDOR,
      },
      tx,
    );

    expect(cateringCalls[0]?.data.status).toBe(CateringStatus.IN_PROGRESS);
    expect(cateringCalls[0]?.data.driverStatus).toBe(DriverStatus.EN_ROUTE_TO_VENDOR);
    expect(res.newStatus).toBe(CateringStatus.IN_PROGRESS);
    expect(res.newDriverStatus).toBe(DriverStatus.EN_ROUTE_TO_VENDOR);
  });

  it('writes COMPLETED on driver COMPLETED', async () => {
    const { tx, cateringCalls } = makeFakeTx();

    await transitionOrder(
      {
        orderType: 'catering',
        orderId: 'order-3',
        currentStatus: CateringStatus.IN_PROGRESS,
        currentDriverStatus: DriverStatus.ARRIVED_TO_CLIENT,
        nextDriverStatus: DriverStatus.COMPLETED,
      },
      tx,
    );

    expect(cateringCalls[0]?.data.status).toBe(CateringStatus.COMPLETED);
    expect(cateringCalls[0]?.data.driverStatus).toBe(DriverStatus.COMPLETED);
  });

  it('routes to onDemand.update for on_demand orderType', async () => {
    const { tx, cateringCalls, onDemandCalls } = makeFakeTx();

    await transitionOrder(
      {
        orderType: 'on_demand',
        orderId: 'order-4',
        currentStatus: CateringStatus.PENDING,
        currentDriverStatus: null,
        nextOrderStatus: CateringStatus.CONFIRMED,
      },
      tx,
    );

    expect(cateringCalls).toHaveLength(0);
    expect(onDemandCalls).toHaveLength(1);
    expect(onDemandCalls[0]?.data.status).toBe(CateringStatus.CONFIRMED);
  });
});

describe('transitionOrder — validation', () => {
  it('throws StateTransitionError on illegal order transition', async () => {
    const { tx, cateringCalls } = makeFakeTx();

    await expect(
      transitionOrder(
        {
          orderType: 'catering',
          orderId: 'order-5',
          currentStatus: CateringStatus.COMPLETED,
          currentDriverStatus: DriverStatus.COMPLETED,
          nextOrderStatus: CateringStatus.PENDING,
        },
        tx,
      ),
    ).rejects.toBeInstanceOf(StateTransitionError);

    // No DB write should have happened.
    expect(cateringCalls).toHaveLength(0);
  });

  it('throws StateTransitionError on illegal driver transition', async () => {
    const { tx, cateringCalls } = makeFakeTx();

    await expect(
      transitionOrder(
        {
          orderType: 'catering',
          orderId: 'order-6',
          currentStatus: CateringStatus.IN_PROGRESS,
          currentDriverStatus: DriverStatus.PICKED_UP,
          nextDriverStatus: DriverStatus.ASSIGNED, // backwards
        },
        tx,
      ),
    ).rejects.toBeInstanceOf(StateTransitionError);

    expect(cateringCalls).toHaveLength(0);
  });

  it('skips the DB write when neither status nor driverStatus changes', async () => {
    const { tx, cateringCalls } = makeFakeTx();

    const res = await transitionOrder(
      {
        orderType: 'catering',
        orderId: 'order-7',
        currentStatus: CateringStatus.IN_PROGRESS,
        currentDriverStatus: DriverStatus.PICKED_UP,
      },
      tx,
    );

    expect(cateringCalls).toHaveLength(0);
    expect(res.newStatus).toBe(CateringStatus.IN_PROGRESS);
  });
});

describe('transitionOrder — side effects', () => {
  it('emits notify_customer + delivery timestamp + cache invalidation on EN_ROUTE_TO_VENDOR', async () => {
    const { tx } = makeFakeTx();
    const res = await transitionOrder(
      {
        orderType: 'catering',
        orderId: 'order-8',
        currentStatus: CateringStatus.ASSIGNED,
        currentDriverStatus: DriverStatus.ASSIGNED,
        nextDriverStatus: DriverStatus.EN_ROUTE_TO_VENDOR,
      },
      tx,
    );

    const kinds = res.sideEffects.map((s) => s.kind).sort();
    expect(kinds).toContain('notify_customer');
    expect(kinds).toContain('upsert_delivery_timestamp');
    expect(kinds).toContain('invalidate_cache');
    expect(kinds).not.toContain('webhook'); // only on COMPLETED
    expect(kinds).not.toContain('notify_admin'); // only on COMPLETED
  });

  it('emits webhook + admin notification on COMPLETED', async () => {
    const { tx } = makeFakeTx();
    const res = await transitionOrder(
      {
        orderType: 'catering',
        orderId: 'order-9',
        currentStatus: CateringStatus.IN_PROGRESS,
        currentDriverStatus: DriverStatus.ARRIVED_TO_CLIENT,
        nextDriverStatus: DriverStatus.COMPLETED,
      },
      tx,
    );

    const kinds = res.sideEffects.map((s) => s.kind);
    expect(kinds).toContain('notify_admin');
    expect(kinds).toContain('webhook');
    const webhook = res.sideEffects.find((s) => s.kind === 'webhook');
    expect(webhook).toMatchObject({ provider: 'catervalley', orderId: 'order-9' });
  });

  it('emits no driver-status side effects when only order status changes', async () => {
    const { tx } = makeFakeTx();
    const res = await transitionOrder(
      {
        orderType: 'catering',
        orderId: 'order-10',
        currentStatus: CateringStatus.PENDING,
        currentDriverStatus: null,
        nextOrderStatus: CateringStatus.CONFIRMED,
      },
      tx,
    );

    const kinds = res.sideEffects.map((s) => s.kind);
    expect(kinds).not.toContain('notify_customer');
    expect(kinds).not.toContain('upsert_delivery_timestamp');
    expect(kinds).toContain('invalidate_cache');
  });
});
