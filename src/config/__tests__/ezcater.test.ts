import type { EzCaterApiHeaders } from '@/types/ezcater';

// Store original env values
const originalEnv = { ...process.env };

// Reset modules and env before each test
beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

// Restore original env after all tests
afterAll(() => {
  process.env = originalEnv;
});

describe('ezCater Config', () => {
  describe('EZCATER_CONFIG', () => {
    it('should use default values when env vars are not set', async () => {
      delete process.env.EZCATER_API_URL;
      delete process.env.EZCATER_API_TOKEN;
      delete process.env.EZCATER_CLIENT_NAME;
      delete process.env.EZCATER_CLIENT_VERSION;
      delete process.env.EZCATER_WEBHOOK_SECRET;

      const { EZCATER_CONFIG } = await import('../ezcater');

      expect(EZCATER_CONFIG.apiUrl).toBe('https://api.ezcater.com/graphql');
      expect(EZCATER_CONFIG.apiToken).toBeUndefined();
      expect(EZCATER_CONFIG.clientName).toBe('ready-set');
      expect(EZCATER_CONFIG.clientVersion).toBe('1.0.0');
      expect(EZCATER_CONFIG.webhookSecret).toBeUndefined();
    });

    it('should use environment variables when set', async () => {
      process.env.EZCATER_API_URL = 'https://custom.api.url/graphql';
      process.env.EZCATER_API_TOKEN = 'test-token-123';
      process.env.EZCATER_CLIENT_NAME = 'custom-client';
      process.env.EZCATER_CLIENT_VERSION = '2.0.0';
      process.env.EZCATER_WEBHOOK_SECRET = 'webhook-secret-456';

      const { EZCATER_CONFIG } = await import('../ezcater');

      expect(EZCATER_CONFIG.apiUrl).toBe('https://custom.api.url/graphql');
      expect(EZCATER_CONFIG.apiToken).toBe('test-token-123');
      expect(EZCATER_CONFIG.clientName).toBe('custom-client');
      expect(EZCATER_CONFIG.clientVersion).toBe('2.0.0');
      expect(EZCATER_CONFIG.webhookSecret).toBe('webhook-secret-456');
    });
  });

  describe('isEzCaterEnabled', () => {
    it('should return false when API token is not set', async () => {
      delete process.env.EZCATER_API_TOKEN;

      const { isEzCaterEnabled } = await import('../ezcater');

      expect(isEzCaterEnabled()).toBe(false);
    });

    it('should return false when API token is empty string', async () => {
      process.env.EZCATER_API_TOKEN = '';

      const { isEzCaterEnabled } = await import('../ezcater');

      expect(isEzCaterEnabled()).toBe(false);
    });

    it('should return true when API token is configured', async () => {
      process.env.EZCATER_API_TOKEN = 'valid-token';

      const { isEzCaterEnabled } = await import('../ezcater');

      expect(isEzCaterEnabled()).toBe(true);
    });
  });

  describe('checkEzCaterConfig', () => {
    it('should return invalid when API token is missing', async () => {
      delete process.env.EZCATER_API_TOKEN;

      const { checkEzCaterConfig } = await import('../ezcater');
      const result = checkEzCaterConfig();

      expect(result.isValid).toBe(false);
      expect(result.missingVars).toContain('EZCATER_API_TOKEN');
    });

    it('should return valid when API token is configured', async () => {
      process.env.EZCATER_API_TOKEN = 'valid-token';

      const { checkEzCaterConfig } = await import('../ezcater');
      const result = checkEzCaterConfig();

      expect(result.isValid).toBe(true);
      expect(result.missingVars).toHaveLength(0);
    });
  });

  describe('validateEzCaterConfig', () => {
    it('should throw error when API token is missing', async () => {
      delete process.env.EZCATER_API_TOKEN;

      const { validateEzCaterConfig } = await import('../ezcater');

      expect(() => validateEzCaterConfig()).toThrow(
        /Missing required environment variables.*EZCATER_API_TOKEN/
      );
    });

    it('should not throw when API token is configured', async () => {
      process.env.EZCATER_API_TOKEN = 'valid-token';

      const { validateEzCaterConfig } = await import('../ezcater');

      expect(() => validateEzCaterConfig()).not.toThrow();
    });
  });

  describe('getEzCaterHeaders', () => {
    it('should throw error when API token is not configured', async () => {
      delete process.env.EZCATER_API_TOKEN;

      const { getEzCaterHeaders } = await import('../ezcater');

      expect(() => getEzCaterHeaders()).toThrow(
        /Missing required environment variables/
      );
    });

    it('should return correct headers when configured', async () => {
      process.env.EZCATER_API_TOKEN = 'test-token';
      process.env.EZCATER_CLIENT_NAME = 'test-client';
      process.env.EZCATER_CLIENT_VERSION = '1.2.3';

      const { getEzCaterHeaders } = await import('../ezcater');
      const headers: EzCaterApiHeaders = getEzCaterHeaders();

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBe('test-token');
      expect(headers['apollographql-client-name']).toBe('test-client');
      expect(headers['apollographql-client-version']).toBe('1.2.3');
    });

    it('should use default client name and version', async () => {
      process.env.EZCATER_API_TOKEN = 'test-token';
      delete process.env.EZCATER_CLIENT_NAME;
      delete process.env.EZCATER_CLIENT_VERSION;

      const { getEzCaterHeaders } = await import('../ezcater');
      const headers = getEzCaterHeaders();

      expect(headers['apollographql-client-name']).toBe('ready-set');
      expect(headers['apollographql-client-version']).toBe('1.0.0');
    });
  });

  describe('getEzCaterApiUrl', () => {
    it('should return default URL when not configured', async () => {
      delete process.env.EZCATER_API_URL;

      const { getEzCaterApiUrl } = await import('../ezcater');

      expect(getEzCaterApiUrl()).toBe('https://api.ezcater.com/graphql');
    });

    it('should return custom URL when configured', async () => {
      process.env.EZCATER_API_URL = 'https://staging.api.ezcater.com/graphql';

      const { getEzCaterApiUrl } = await import('../ezcater');

      expect(getEzCaterApiUrl()).toBe(
        'https://staging.api.ezcater.com/graphql'
      );
    });
  });
});
