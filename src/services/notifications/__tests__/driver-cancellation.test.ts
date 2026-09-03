/**
 * notifyDriverOrderCancelled — SMS to the assigned driver when dispatch cancels
 * an order (2026-08-22 product decision after a driver kept working a cancelled
 * order on 08-21). The helper must never throw: a missing Twilio config or a
 * provider failure degrades to a logged skip/failure, never a 500 on the PATCH.
 */

jest.mock('@/lib/sms', () => ({
  getSmsProvider: jest.fn(),
}));

import { getSmsProvider } from '@/lib/sms';
import { notifyDriverOrderCancelled } from '../driver-cancellation';

const mockedGetSmsProvider = jest.mocked(getSmsProvider);

const baseInput = {
  driverProfileId: 'driver-456',
  driverName: 'John Driver',
  phone: '555-1234',
  orderNumber: 'Test 0821261',
  orderType: 'catering' as const,
};

describe('notifyDriverOrderCancelled', () => {
  let send: jest.Mock;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    send = jest.fn().mockResolvedValue({ success: true, messageId: 'SM123' });
    mockedGetSmsProvider.mockReturnValue({ send });
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('sends an SMS to the driver phone with the order number in the body', async () => {
    const result = await notifyDriverOrderCancelled(baseInput);

    expect(result).toEqual({ sms: 'sent' });
    expect(send).toHaveBeenCalledTimes(1);
    const [to, body] = send.mock.calls[0] as [string, string];
    expect(to).toBe('555-1234');
    expect(body).toContain('Test 0821261');
    expect(body.toLowerCase()).toContain('cancel');
  });

  it('keeps the SMS body within a single 160-character segment', async () => {
    await notifyDriverOrderCancelled({ ...baseInput, orderNumber: 'CV-ORDER-2026-08-22-000123' });

    const [, body] = send.mock.calls[0] as [string, string];
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it('skips without touching the provider when the driver has no phone', async () => {
    const result = await notifyDriverOrderCancelled({ ...baseInput, phone: null });

    expect(result).toEqual({ sms: 'skipped' });
    expect(mockedGetSmsProvider).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('skips (does not throw) when the SMS provider cannot be constructed', async () => {
    mockedGetSmsProvider.mockImplementation(() => {
      throw new Error('Missing Twilio configuration');
    });

    const result = await notifyDriverOrderCancelled(baseInput);

    expect(result).toEqual({ sms: 'skipped', error: 'Missing Twilio configuration' });
    expect(send).not.toHaveBeenCalled();
  });

  it('reports a failure when the provider rejects the message', async () => {
    send.mockResolvedValue({ success: false, error: 'Twilio 21614: not a mobile number' });

    const result = await notifyDriverOrderCancelled(baseInput);

    expect(result).toEqual({ sms: 'failed', error: 'Twilio 21614: not a mobile number' });
  });

  it('reports a failure (does not throw) when send itself throws', async () => {
    send.mockRejectedValue(new Error('network down'));

    await expect(notifyDriverOrderCancelled(baseInput)).resolves.toEqual({
      sms: 'failed',
      error: 'network down',
    });
  });
});
