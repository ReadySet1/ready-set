/**
 * @jest-environment node
 */
// src/__tests__/services/caterValleyService.outbound.test.ts
//
// Verifies outbound webhook hardening added in Phase 1:
// - HMAC signing on the outbound POST when secret is configured
// - SSRF guard rejects unsafe URLs configured via env

import { updateCaterValleyOrderStatus } from '@/services/caterValleyService';
import { signPayload, SIGNATURE_HEADER } from '@/lib/security/hmac';

describe('updateCaterValleyOrderStatus — outbound webhook security', () => {
  const ORIGINAL = {
    url: process.env.CATERVALLEY_WEBHOOK_URL,
    secret: process.env.CATERVALLEY_OUTBOUND_WEBHOOK_SECRET,
    nodeEnv: process.env.NODE_ENV,
  };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.CATERVALLEY_WEBHOOK_URL = 'https://api.catervalley.com/webhook';
    process.env.NODE_ENV = 'test';
    delete process.env.CATERVALLEY_OUTBOUND_WEBHOOK_SECRET;

    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: true, message: 'ok', data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (ORIGINAL.url === undefined) delete process.env.CATERVALLEY_WEBHOOK_URL;
    else process.env.CATERVALLEY_WEBHOOK_URL = ORIGINAL.url;
    if (ORIGINAL.secret === undefined) delete process.env.CATERVALLEY_OUTBOUND_WEBHOOK_SECRET;
    else process.env.CATERVALLEY_OUTBOUND_WEBHOOK_SECRET = ORIGINAL.secret;
    process.env.NODE_ENV = ORIGINAL.nodeEnv;
  });

  it('does not send signature header when no outbound secret is configured', async () => {
    await updateCaterValleyOrderStatus('CV-ABC123', 'CONFIRM');
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers[SIGNATURE_HEADER]).toBeUndefined();
  });

  it('signs the body with HMAC-SHA256 when outbound secret is configured', async () => {
    process.env.CATERVALLEY_OUTBOUND_WEBHOOK_SECRET = 'shared-secret-with-catervalley';

    await updateCaterValleyOrderStatus('CV-ABC123', 'COMPLETED');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const sentBody = init.body as string;

    expect(headers[SIGNATURE_HEADER]).toBeDefined();
    expect(headers[SIGNATURE_HEADER]).toMatch(/^[a-f0-9]{64}$/);

    const expected = await signPayload('shared-secret-with-catervalley', sentBody);
    expect(headers[SIGNATURE_HEADER]).toBe(expected);
  });

  it('rejects without sending when CATERVALLEY_WEBHOOK_URL points at localhost', async () => {
    process.env.CATERVALLEY_WEBHOOK_URL = 'http://localhost:8080/webhook';
    const result = await updateCaterValleyOrderStatus('CV-ABC123', 'CONFIRM');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Refusing to call CaterValley webhook/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects without sending when URL points at AWS metadata IP', async () => {
    process.env.CATERVALLEY_WEBHOOK_URL = 'http://169.254.169.254/latest/meta-data/';
    const result = await updateCaterValleyOrderStatus('CV-ABC123', 'CONFIRM');
    expect(result.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects http URL in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CATERVALLEY_WEBHOOK_URL = 'http://api.catervalley.com/webhook';
    const result = await updateCaterValleyOrderStatus('CV-ABC123', 'CONFIRM');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/HTTPS required/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes through https public URLs', async () => {
    process.env.CATERVALLEY_WEBHOOK_URL = 'https://api.catervalley.com/v1/status';
    const result = await updateCaterValleyOrderStatus('CV-ABC123', 'CONFIRM');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.catervalley.com/v1/status',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.success).toBe(true);
  });
});
