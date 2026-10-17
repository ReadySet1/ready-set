// src/__tests__/services/partnerWebhookService.test.ts
//
// Unit tests for the registry-driven partner webhook dispatcher:
// status mapping, the skip-when-unconfigured guard, HMAC-signed POST,
// enqueue + single in-request attempt (retries belong to the cron worker),
// and the record+dispatch orchestration (history write, legacy-carrier
// guard, non-partner no-op).

import {
  dispatchPartnerWebhook,
  recordAndDispatchLifecycleEvent,
  DRIVER_STATUS_TO_PARTNER_LIFECYCLE,
} from '@/lib/services/partnerWebhookService';
import { prisma } from '@/lib/db/prisma';
import { getPartnerByOrderNumber } from '@/lib/services/partner-registry';
import { signPayload } from '@/lib/security/hmac';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    orderStatusHistory: { create: jest.fn() },
    partnerWebhookDelivery: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
  },
}));

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

jest.mock('@/lib/services/partner-registry', () => ({
  getPartnerByOrderNumber: jest.fn(),
}));

jest.mock('@/lib/security/hmac', () => ({
  SIGNATURE_HEADER: 'x-readyset-signature',
  signPayload: jest.fn(async () => 'sig123'),
}));

jest.mock('@/lib/services/webhook-logger', () => ({
  webhookLogger: { logSuccess: jest.fn(), logFailure: jest.fn() },
}));

jest.mock('@/utils/logger', () => ({
  carrierLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const PARTNER = {
  id: 'partner-cc-id',
  slug: 'catercow',
  displayName: 'CaterCow',
  orderPrefix: 'CC-',
  webhookUrl: 'https://hook.example.com/ready_set',
  webhookSecret: 'shared-secret',
  rateLimitPerMin: 100,
  isActive: true,
};

const mockFetch = jest.fn();
const deliveries = prisma.partnerWebhookDelivery as unknown as {
  create: jest.Mock;
  findUnique: jest.Mock;
  updateMany: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
  deliveries.create.mockResolvedValue({ id: 'delivery-1', attempts: 0 });
  deliveries.updateMany.mockResolvedValue({ count: 1 });
});

describe('DRIVER_STATUS_TO_PARTNER_LIFECYCLE', () => {
  it('maps client-leg statuses to partner lifecycle and vendor-leg to null', () => {
    expect(DRIVER_STATUS_TO_PARTNER_LIFECYCLE.ASSIGNED).toBe('ASSIGNED');
    expect(DRIVER_STATUS_TO_PARTNER_LIFECYCLE.PICKED_UP).toBe('PICKED_UP');
    expect(DRIVER_STATUS_TO_PARTNER_LIFECYCLE.EN_ROUTE_TO_CLIENT).toBe('ON_THE_WAY');
    expect(DRIVER_STATUS_TO_PARTNER_LIFECYCLE.ARRIVED_TO_CLIENT).toBe('ARRIVED');
    expect(DRIVER_STATUS_TO_PARTNER_LIFECYCLE.COMPLETED).toBe('DELIVERED');
    expect(DRIVER_STATUS_TO_PARTNER_LIFECYCLE.EN_ROUTE_TO_VENDOR).toBeNull();
    expect(DRIVER_STATUS_TO_PARTNER_LIFECYCLE.ARRIVED_AT_VENDOR).toBeNull();
  });
});

describe('dispatchPartnerWebhook', () => {
  const baseInput = {
    partner: PARTNER,
    orderId: 'order-uuid',
    orderCode: '12345',
    orderNumber: 'CC-12345',
    status: 'ASSIGNED' as const,
  };

  it('skips (no fetch) when the partner has no webhook URL or secret', async () => {
    const result = await dispatchPartnerWebhook({
      ...baseInput,
      partner: { ...PARTNER, webhookUrl: null },
    });

    expect(result).toEqual({ delivered: false, skipped: 'misconfigured', attempts: 0, httpStatus: null });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(deliveries.create).not.toHaveBeenCalled();
  });

  it('POSTs an HMAC-signed payload and reports delivery on 200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    const result = await dispatchPartnerWebhook(baseInput);

    expect(result).toEqual({ delivered: true, attempts: 1, httpStatus: 200, queued: true });
    expect(signPayload).toHaveBeenCalledWith('shared-secret', expect.any(String));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(PARTNER.webhookUrl);
    expect(init.method).toBe('POST');
    expect(init.headers['x-readyset-signature']).toBe('sig123');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ orderId: 'order-uuid', orderCode: '12345', orderNumber: 'CC-12345', status: 'ASSIGNED' });
    expect(typeof body.timestamp).toBe('string');
  });

  it('enqueues the event before the first attempt and signs exactly the queued payload', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await dispatchPartnerWebhook({ ...baseInput, statusHistoryId: 'hist-1' });

    const { data } = deliveries.create.mock.calls[0][0];
    expect(data).toMatchObject({
      partnerId: 'partner-cc-id',
      cateringRequestId: 'order-uuid',
      orderNumber: 'CC-12345',
      statusHistoryId: 'hist-1',
      eventStatus: 'ASSIGNED',
      state: 'PENDING',
    });
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual(data.payload);
    expect(signPayload).toHaveBeenCalledWith('shared-secret', init.body);
  });

  it('records a success on the queued row', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await dispatchPartnerWebhook(baseInput);

    expect(deliveries.updateMany).toHaveBeenCalledWith({
      where: { id: 'delivery-1', state: 'PENDING', attempts: 0 },
      data: expect.objectContaining({ state: 'SUCCEEDED', attempts: 1 }),
    });
  });

  it.each([400, 503])(
    'makes a single in-request attempt on HTTP %i and leaves the retry to the worker',
    async (status) => {
      mockFetch.mockResolvedValueOnce({ ok: false, status });

      const result = await dispatchPartnerWebhook(baseInput);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ delivered: false, attempts: 1, httpStatus: status, queued: true });
      expect(deliveries.updateMany).toHaveBeenCalledWith({
        where: { id: 'delivery-1', state: 'PENDING', attempts: 0 },
        data: expect.objectContaining({ state: 'PENDING', attempts: 1, lastStatusCode: status }),
      });
    },
  );

  it('does not send again when the event is already queued', async () => {
    deliveries.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    deliveries.findUnique.mockResolvedValueOnce({ id: 'delivery-1', attempts: 1 });

    const result = await dispatchPartnerWebhook({ ...baseInput, statusHistoryId: 'hist-1' });

    expect(result).toEqual({ delivered: false, skipped: 'duplicate', attempts: 0, httpStatus: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('still makes the in-request attempt when the queue write fails', async () => {
    deliveries.create.mockRejectedValueOnce(new Error('relation does not exist'));
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await dispatchPartnerWebhook(baseInput);

    expect(result).toEqual({ delivered: true, attempts: 1, httpStatus: 200, queued: false });
    expect(deliveries.updateMany).not.toHaveBeenCalled();
  });
});

describe('recordAndDispatchLifecycleEvent', () => {
  it('no-ops for legacy CARRIER_CONFIGS orders (CV-) without resolving a partner', async () => {
    await recordAndDispatchLifecycleEvent({
      orderId: 'o1',
      orderNumber: 'CV-999',
      partnerStatus: 'ASSIGNED',
    });

    expect(getPartnerByOrderNumber).not.toHaveBeenCalled();
    expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('records history and dispatches for a registry partner order', async () => {
    (getPartnerByOrderNumber as jest.Mock).mockResolvedValueOnce(PARTNER);
    (prisma.orderStatusHistory.create as jest.Mock).mockResolvedValueOnce({ id: 'hist-9' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    await recordAndDispatchLifecycleEvent({
      orderId: 'order-uuid',
      orderNumber: 'CC-12345',
      partnerStatus: 'DELIVERED',
      driverStatus: 'COMPLETED',
      changedBy: 'driver-1',
    });

    expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cateringRequestId: 'order-uuid',
        partnerStatus: 'DELIVERED',
        driverStatus: 'COMPLETED',
        changedBy: 'driver-1',
      }),
      select: { id: true },
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(deliveries.create.mock.calls[0][0].data).toMatchObject({
      statusHistoryId: 'hist-9',
      eventStatus: 'DELIVERED',
    });
  });

  it('still dispatches (without an idempotency key) when the history write fails', async () => {
    (getPartnerByOrderNumber as jest.Mock).mockResolvedValueOnce(PARTNER);
    (prisma.orderStatusHistory.create as jest.Mock).mockRejectedValueOnce(new Error('db down'));
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await recordAndDispatchLifecycleEvent({
      orderId: 'order-uuid',
      orderNumber: 'CC-12345',
      partnerStatus: 'ASSIGNED',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(deliveries.create.mock.calls[0][0].data).toMatchObject({ statusHistoryId: null });
  });

  it('no-ops when the order is not owned by any registry partner', async () => {
    (getPartnerByOrderNumber as jest.Mock).mockResolvedValueOnce(null);

    await recordAndDispatchLifecycleEvent({
      orderId: 'o2',
      orderNumber: 'XX-1', // not a legacy carrier, no registry match
      partnerStatus: 'ASSIGNED',
    });

    expect(prisma.orderStatusHistory.create).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
