// src/__tests__/services/partnerWebhookService.test.ts
//
// Unit tests for the registry-driven partner webhook dispatcher:
// status mapping, the skip-when-unconfigured guard, HMAC-signed POST,
// no-retry-on-4xx, and the record+dispatch orchestration (history write,
// legacy-carrier guard, non-partner no-op).

import {
  dispatchPartnerWebhook,
  recordAndDispatchLifecycleEvent,
  DRIVER_STATUS_TO_PARTNER_LIFECYCLE,
} from '@/lib/services/partnerWebhookService';
import { prisma } from '@/lib/db/prisma';
import { getPartnerByOrderNumber } from '@/lib/services/partner-registry';
import { signPayload } from '@/lib/security/hmac';

jest.mock('@/lib/db/prisma', () => ({
  prisma: { orderStatusHistory: { create: jest.fn() } },
}));

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

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
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
  });

  it('POSTs an HMAC-signed payload and reports delivery on 200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    const result = await dispatchPartnerWebhook(baseInput);

    expect(result).toEqual({ delivered: true, attempts: 1, httpStatus: 200 });
    expect(signPayload).toHaveBeenCalledWith('shared-secret', expect.any(String));

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(PARTNER.webhookUrl);
    expect(init.method).toBe('POST');
    expect(init.headers['x-readyset-signature']).toBe('sig123');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ orderId: 'order-uuid', orderCode: '12345', orderNumber: 'CC-12345', status: 'ASSIGNED' });
    expect(typeof body.timestamp).toBe('string');
  });

  it('does not retry on a 4xx response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) });

    const result = await dispatchPartnerWebhook(baseInput);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ delivered: false, httpStatus: 400 });
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
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
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
