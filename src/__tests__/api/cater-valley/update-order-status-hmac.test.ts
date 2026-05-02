// src/__tests__/api/cater-valley/update-order-status-hmac.test.ts

import { POST } from '@/app/api/cater-valley/update-order-status/route';
import * as caterValleyService from '@/services/caterValleyService';
import { signPayload, SIGNATURE_HEADER } from '@/lib/security/hmac';

jest.mock('@/services/caterValleyService', () => ({
  updateCaterValleyOrderStatus: jest.fn(),
  ALLOWED_STATUSES: ['CONFIRM', 'READY', 'ON_THE_WAY', 'COMPLETED', 'CANCELLED', 'REFUNDED'],
}));

describe('POST /api/cater-valley/update-order-status — HMAC verification', () => {
  const ORIGINAL = {
    secret: process.env.CATERVALLEY_INBOUND_WEBHOOK_SECRET,
    enforce: process.env.ENFORCE_INBOUND_WEBHOOK_HMAC,
  };
  const SHARED_SECRET = 'inbound-webhook-shared-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    (caterValleyService.updateCaterValleyOrderStatus as jest.Mock).mockResolvedValue({
      success: true,
      orderFound: true,
      response: {},
    });
  });

  afterEach(() => {
    if (ORIGINAL.secret === undefined) delete process.env.CATERVALLEY_INBOUND_WEBHOOK_SECRET;
    else process.env.CATERVALLEY_INBOUND_WEBHOOK_SECRET = ORIGINAL.secret;
    if (ORIGINAL.enforce === undefined) delete process.env.ENFORCE_INBOUND_WEBHOOK_HMAC;
    else process.env.ENFORCE_INBOUND_WEBHOOK_HMAC = ORIGINAL.enforce;
  });

  function createRequest(body: object, headers: Record<string, string> = {}): Request {
    return new Request('http://localhost:3000/api/cater-valley/update-order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  describe('no secret configured (initial rollout state)', () => {
    beforeEach(() => {
      delete process.env.CATERVALLEY_INBOUND_WEBHOOK_SECRET;
    });

    it('accepts requests without signature header (back-compat)', async () => {
      const response = await POST(createRequest({ orderNumber: 'CV-1', status: 'READY' }));
      expect(response.status).toBe(200);
    });
  });

  describe('secret configured, log-only mode (ENFORCE=false)', () => {
    beforeEach(() => {
      process.env.CATERVALLEY_INBOUND_WEBHOOK_SECRET = SHARED_SECRET;
      process.env.ENFORCE_INBOUND_WEBHOOK_HMAC = 'false';
    });

    it('still processes request when signature is missing', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const response = await POST(createRequest({ orderNumber: 'CV-1', status: 'READY' }));
      expect(response.status).toBe(200);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('log-only'),
        expect.any(Object)
      );
      warnSpy.mockRestore();
    });

    it('still processes request when signature is wrong', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const response = await POST(
        createRequest(
          { orderNumber: 'CV-1', status: 'READY' },
          { [SIGNATURE_HEADER]: 'a'.repeat(64) }
        )
      );
      expect(response.status).toBe(200);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('log-only'),
        expect.objectContaining({ result: 'mismatch' })
      );
      warnSpy.mockRestore();
    });

    it('does not warn when signature is valid', async () => {
      const body = { orderNumber: 'CV-1', status: 'READY' };
      const sig = signPayload(SHARED_SECRET, JSON.stringify(body));
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const response = await POST(createRequest(body, { [SIGNATURE_HEADER]: sig }));
      expect(response.status).toBe(200);
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('secret configured, enforced mode (ENFORCE=true)', () => {
    beforeEach(() => {
      process.env.CATERVALLEY_INBOUND_WEBHOOK_SECRET = SHARED_SECRET;
      process.env.ENFORCE_INBOUND_WEBHOOK_HMAC = 'true';
    });

    it('rejects requests with no signature header (401)', async () => {
      const response = await POST(createRequest({ orderNumber: 'CV-1', status: 'READY' }));
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.message).toMatch(/signature/i);
      expect(caterValleyService.updateCaterValleyOrderStatus).not.toHaveBeenCalled();
    });

    it('rejects requests with wrong signature (401)', async () => {
      const response = await POST(
        createRequest(
          { orderNumber: 'CV-1', status: 'READY' },
          { [SIGNATURE_HEADER]: 'b'.repeat(64) }
        )
      );
      expect(response.status).toBe(401);
      expect(caterValleyService.updateCaterValleyOrderStatus).not.toHaveBeenCalled();
    });

    it('accepts requests with valid signature', async () => {
      const body = { orderNumber: 'CV-1', status: 'READY' };
      const sig = signPayload(SHARED_SECRET, JSON.stringify(body));
      const response = await POST(createRequest(body, { [SIGNATURE_HEADER]: sig }));
      expect(response.status).toBe(200);
      expect(caterValleyService.updateCaterValleyOrderStatus).toHaveBeenCalledWith('CV-1', 'READY');
    });

    it('rejects requests where body has been tampered with after signing', async () => {
      const originalBody = { orderNumber: 'CV-1', status: 'READY' };
      const sig = signPayload(SHARED_SECRET, JSON.stringify(originalBody));
      const tamperedRequest = new Request(
        'http://localhost:3000/api/cater-valley/update-order-status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', [SIGNATURE_HEADER]: sig },
          body: JSON.stringify({ orderNumber: 'CV-1', status: 'CANCELLED' }),
        }
      );
      const response = await POST(tamperedRequest);
      expect(response.status).toBe(401);
      expect(caterValleyService.updateCaterValleyOrderStatus).not.toHaveBeenCalled();
    });
  });
});
