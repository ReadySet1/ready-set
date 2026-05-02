// src/__tests__/lib/security/ssrf-guard.test.ts

import { checkOutboundUrl, assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';

describe('checkOutboundUrl', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
  });

  describe('public hostnames', () => {
    it('allows public https URLs', () => {
      expect(checkOutboundUrl('https://api.catervalley.com/webhook')).toEqual({ ok: true });
      expect(checkOutboundUrl('https://api.catercow.com/v1/webhooks/readyset')).toEqual({
        ok: true,
      });
    });

    it('allows http URLs in non-production', () => {
      process.env.NODE_ENV = 'development';
      expect(checkOutboundUrl('http://api.example.com/webhook')).toEqual({ ok: true });
    });
  });

  describe('blocked literals', () => {
    it.each(['localhost', '127.0.0.1', '0.0.0.0', '::1'])('rejects %s', (host) => {
      const result = checkOutboundUrl(`https://${host.includes(':') ? `[${host}]` : host}/x`);
      expect(result.ok).toBe(false);
    });

    it('rejects metadata.google.internal (cloud SSRF target)', () => {
      const result = checkOutboundUrl('http://metadata.google.internal/computeMetadata/v1/');
      expect(result.ok).toBe(false);
    });
  });

  describe('private IPv4 ranges', () => {
    it.each([
      '10.0.0.1',
      '10.255.255.255',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '192.168.1.1',
      '169.254.169.254', // AWS metadata
      '100.64.0.1', // CGNAT
    ])('rejects %s', (host) => {
      expect(checkOutboundUrl(`https://${host}/`).ok).toBe(false);
    });

    it('does NOT reject public addresses inside boundary octets', () => {
      expect(checkOutboundUrl('https://172.15.0.1/').ok).toBe(true);
      expect(checkOutboundUrl('https://172.32.0.1/').ok).toBe(true);
      expect(checkOutboundUrl('https://192.169.0.1/').ok).toBe(true);
    });
  });

  describe('IPv4-mapped and -compatible IPv6', () => {
    it.each([
      '::ffff:127.0.0.1',
      '::ffff:10.0.0.1',
      '::ffff:192.168.1.1',
      '::ffff:169.254.169.254',
    ])('rejects IPv4-mapped IPv6 to private space: %s', (host) => {
      const result = checkOutboundUrl(`http://[${host}]/`);
      expect(result.ok).toBe(false);
    });

    it('rejects IPv4-compatible IPv6 to loopback', () => {
      expect(checkOutboundUrl('http://[::127.0.0.1]/').ok).toBe(false);
    });
  });

  describe('production https enforcement', () => {
    it('rejects http URLs in production', () => {
      process.env.NODE_ENV = 'production';
      const result = checkOutboundUrl('http://api.example.com/webhook');
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/HTTPS required/i);
    });

    it('allows https URLs in production', () => {
      process.env.NODE_ENV = 'production';
      expect(checkOutboundUrl('https://api.catervalley.com/webhook').ok).toBe(true);
    });

    it('option requireHttps overrides env', () => {
      process.env.NODE_ENV = 'development';
      const result = checkOutboundUrl('http://api.example.com/webhook', { requireHttps: true });
      expect(result.ok).toBe(false);
    });
  });

  describe('protocol filtering', () => {
    it.each(['file:///etc/passwd', 'gopher://x.com', 'ftp://x.com'])(
      'rejects non-http protocol: %s',
      (url) => {
        expect(checkOutboundUrl(url).ok).toBe(false);
      }
    );
  });

  it('rejects malformed URLs', () => {
    expect(checkOutboundUrl('not a url').ok).toBe(false);
    expect(checkOutboundUrl('').ok).toBe(false);
  });

  describe('assertSafeOutboundUrl', () => {
    it('throws on rejection', () => {
      expect(() => assertSafeOutboundUrl('http://localhost:8080/')).toThrow(/SSRF/i);
    });

    it('does not throw on safe URLs', () => {
      expect(() => assertSafeOutboundUrl('https://api.catervalley.com/')).not.toThrow();
    });
  });
});
