import { locationRateLimiter, RateLimitExceededError } from '../location-rate-limiter';
import { RATE_LIMIT_CONFIG } from '@/constants/realtime-config';

// Mock timer functions
jest.useFakeTimers();

describe('LocationRateLimiter', () => {
  beforeEach(() => {
    locationRateLimiter.clear();
    jest.clearAllTimers();
  });

  afterAll(() => {
    locationRateLimiter.destroy();
    jest.useRealTimers();
  });

  describe('checkLimit', () => {
    it('should allow first request for a driver', () => {
      const result = locationRateLimiter.checkLimit('driver-1');

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeNull();
      expect(result.message).toBe('Request allowed');
    });

    it('should allow request after sufficient time has passed', () => {
      locationRateLimiter.recordUpdate('driver-1');

      // Advance time past the rate limit interval
      jest.advanceTimersByTime(RATE_LIMIT_CONFIG.MIN_UPDATE_INTERVAL_MS + 100);

      const result = locationRateLimiter.checkLimit('driver-1');
      expect(result.allowed).toBe(true);
    });

    it('should block rapid requests within rate limit window', () => {
      locationRateLimiter.recordUpdate('driver-1');

      // Advance time but not past the limit
      jest.advanceTimersByTime(1000); // 1 second

      const result = locationRateLimiter.checkLimit('driver-1');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.message).toContain('Rate limit exceeded');
    });

    it('should track different drivers independently', () => {
      locationRateLimiter.recordUpdate('driver-1');

      // Driver 2 should still be allowed
      const result = locationRateLimiter.checkLimit('driver-2');
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkAndRecordLimit', () => {
    it('should atomically check and record first request', () => {
      const result = locationRateLimiter.checkAndRecordLimit('driver-1');

      expect(result.allowed).toBe(true);

      // Immediate second request should be blocked
      const result2 = locationRateLimiter.checkAndRecordLimit('driver-1');
      expect(result2.allowed).toBe(false);
    });

    it('should allow request after rate limit window', () => {
      locationRateLimiter.checkAndRecordLimit('driver-1');

      // Advance past rate limit window
      jest.advanceTimersByTime(RATE_LIMIT_CONFIG.MIN_UPDATE_INTERVAL_MS + 100);

      const result = locationRateLimiter.checkAndRecordLimit('driver-1');
      expect(result.allowed).toBe(true);
    });

    it('should return retry-after duration when blocked', () => {
      locationRateLimiter.checkAndRecordLimit('driver-1');

      jest.advanceTimersByTime(1000);

      const result = locationRateLimiter.checkAndRecordLimit('driver-1');

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(RATE_LIMIT_CONFIG.MIN_UPDATE_INTERVAL_MS - 1000);
    });
  });

  describe('recordUpdate', () => {
    it('should record update time', () => {
      locationRateLimiter.recordUpdate('driver-1');

      // Immediate check should block
      const result = locationRateLimiter.checkLimit('driver-1');
      expect(result.allowed).toBe(false);
    });

    it('should update existing record', () => {
      locationRateLimiter.recordUpdate('driver-1');

      jest.advanceTimersByTime(RATE_LIMIT_CONFIG.MIN_UPDATE_INTERVAL_MS + 100);

      locationRateLimiter.recordUpdate('driver-1');

      // Should be blocked again
      const result = locationRateLimiter.checkLimit('driver-1');
      expect(result.allowed).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for specific driver', () => {
      locationRateLimiter.recordUpdate('driver-1');
      locationRateLimiter.recordUpdate('driver-2');

      // Reset driver-1 only
      locationRateLimiter.reset('driver-1');

      // Driver-1 should be allowed
      expect(locationRateLimiter.checkLimit('driver-1').allowed).toBe(true);

      // Driver-2 should still be blocked
      expect(locationRateLimiter.checkLimit('driver-2').allowed).toBe(false);
    });

    it('should reset violation count', () => {
      // Trigger violations
      locationRateLimiter.recordUpdate('driver-1');
      locationRateLimiter.checkLimit('driver-1');
      locationRateLimiter.checkLimit('driver-1');

      expect(locationRateLimiter.getViolationCount('driver-1')).toBeGreaterThan(0);

      locationRateLimiter.reset('driver-1');

      expect(locationRateLimiter.getViolationCount('driver-1')).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all rate limit data', () => {
      locationRateLimiter.recordUpdate('driver-1');
      locationRateLimiter.recordUpdate('driver-2');
      locationRateLimiter.recordUpdate('driver-3');

      locationRateLimiter.clear();

      // All drivers should be allowed now
      expect(locationRateLimiter.checkLimit('driver-1').allowed).toBe(true);
      expect(locationRateLimiter.checkLimit('driver-2').allowed).toBe(true);
      expect(locationRateLimiter.checkLimit('driver-3').allowed).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const stats = locationRateLimiter.getStats();

      expect(stats).toHaveProperty('activeDrivers');
      expect(stats).toHaveProperty('totalViolations');
      expect(stats).toHaveProperty('maxEntries');
      expect(stats).toHaveProperty('config');
    });

    it('should track active drivers count', () => {
      locationRateLimiter.recordUpdate('driver-1');
      locationRateLimiter.recordUpdate('driver-2');

      const stats = locationRateLimiter.getStats();
      expect(stats.activeDrivers).toBe(2);
    });

    it('should track total violations', () => {
      locationRateLimiter.recordUpdate('driver-1');

      // Trigger violations
      locationRateLimiter.checkLimit('driver-1');
      locationRateLimiter.checkLimit('driver-1');

      const stats = locationRateLimiter.getStats();
      expect(stats.totalViolations).toBe(2);
    });
  });

  describe('getViolationCount', () => {
    it('should return 0 for unknown driver', () => {
      expect(locationRateLimiter.getViolationCount('unknown-driver')).toBe(0);
    });

    it('should track violation count per driver', () => {
      locationRateLimiter.recordUpdate('driver-1');

      // Trigger violations
      locationRateLimiter.checkLimit('driver-1');
      locationRateLimiter.checkLimit('driver-1');
      locationRateLimiter.checkLimit('driver-1');

      expect(locationRateLimiter.getViolationCount('driver-1')).toBe(3);
    });
  });

  describe('initialize', () => {
    it('should be idempotent', () => {
      // Should not throw
      locationRateLimiter.initialize();
      locationRateLimiter.initialize();
      locationRateLimiter.initialize();

      expect(true).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should clear all data', () => {
      locationRateLimiter.recordUpdate('driver-1');
      locationRateLimiter.destroy();

      expect(locationRateLimiter.getStats().activeDrivers).toBe(0);
    });
  });
});

describe('RateLimitExceededError', () => {
  it('should create error with driver ID and retry after', () => {
    const error = new RateLimitExceededError('driver-123', 5000);

    expect(error.name).toBe('RateLimitExceededError');
    expect(error.driverId).toBe('driver-123');
    expect(error.retryAfter).toBe(5000);
    expect(error.message).toContain('driver-123');
    expect(error.message).toContain('5 seconds');
  });

  it('should be an instance of Error', () => {
    const error = new RateLimitExceededError('driver-123', 5000);
    expect(error).toBeInstanceOf(Error);
  });
});
