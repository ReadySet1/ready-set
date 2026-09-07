/**
 * sendDeliveryNotifications used to live in src/app/actions/email.ts, a
 * "use server" module — which made it a public POST endpoint that emailed a
 * confirmation for ANY order id. It is only ever called server-side from the
 * orders route, so it now lives in a plain service module.
 */
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    cateringRequest: { findUnique: jest.fn() },
    onDemand: { findUnique: jest.fn() },
  },
}));
jest.mock('@/services/email-notification', () => ({
  sendOrderConfirmationToCustomer: jest.fn().mockResolvedValue(true),
}));

import { prisma } from '@/utils/prismaDB';
import { sendOrderConfirmationToCustomer } from '@/services/email-notification';
import { sendDeliveryNotifications } from '../delivery-notifications';

const mockedPrisma = prisma as any;

describe('sendDeliveryNotifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is not exported from the server-actions module', async () => {
    const actions = await import('@/app/actions/email');
    expect((actions as Record<string, unknown>).sendDeliveryNotifications).toBeUndefined();
  });

  it('emails the catering customer when the order exists', async () => {
    mockedPrisma.cateringRequest.findUnique.mockResolvedValue({
      orderNumber: 'CAT-1',
      user: { name: 'Ana', email: 'ana@example.com' },
      pickupDateTime: new Date(),
      arrivalDateTime: new Date(),
      orderTotal: 100,
      pickupAddress: null,
      deliveryAddress: null,
    });
    const result = await sendDeliveryNotifications({ orderId: 'o-1', customerEmail: null });
    expect(result).toEqual({ success: true });
    expect(sendOrderConfirmationToCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: 'CAT-1', orderType: 'catering' }),
    );
  });

  it('reports a missing order', async () => {
    mockedPrisma.cateringRequest.findUnique.mockResolvedValue(null);
    mockedPrisma.onDemand.findUnique.mockResolvedValue(null);
    const result = await sendDeliveryNotifications({ orderId: 'o-404', customerEmail: null });
    expect(result).toEqual({ success: false, error: 'Order not found' });
  });
});
