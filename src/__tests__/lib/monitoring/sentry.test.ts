/**
 * Unit tests for Sentry monitoring utilities
 */

import * as Sentry from '@sentry/nextjs';
import {
  setSentryUser,
  setSentryContext,
  addSentryBreadcrumb,
  captureException,
  captureMessage,
  startSpan,
  setSentryTags,
  logErrorToSentry,
  type SentryUser,
} from '@/lib/monitoring/sentry';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  setUser: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setTags: jest.fn(),
  withScope: jest.fn((callback) => {
    const mockScope = {
      setContext: jest.fn(),
    };
    callback(mockScope);
  }),
  startSpan: jest.fn((config, callback) => callback()),
}));

describe('Sentry Utilities', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('setSentryUser', () => {
    it('should set user context with all fields', () => {
      const user: SentryUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        name: 'Test User',
      };

      setSentryUser(user);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'test@example.com',
        username: 'Test User',
        role: 'admin',
      });
    });

    it('should set user context with minimal fields', () => {
      const user: SentryUser = {
        id: 'user-456',
      };

      setSentryUser(user);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user-456',
        email: undefined,
        username: undefined,
        role: undefined,
      });
    });

    it('should clear user context when null is passed', () => {
      setSentryUser(null);

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('setSentryContext', () => {
    it('should set custom context with data', () => {
      const context = 'delivery';
      const data = {
        deliveryId: '123',
        status: 'in_transit',
        driverId: 'driver-456',
      };

      setSentryContext(context, data);

      expect(Sentry.setContext).toHaveBeenCalledWith(context, data);
    });

    it('should handle empty context data', () => {
      setSentryContext('empty', {});

      expect(Sentry.setContext).toHaveBeenCalledWith('empty', {});
    });
  });

  describe('addSentryBreadcrumb', () => {
    it('should add breadcrumb with all parameters', () => {
      const message = 'User started delivery';
      const data = { deliveryId: '123', driverId: 'driver-456' };
      const level = 'info' as const;

      addSentryBreadcrumb(message, data, level);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message,
        level,
        data,
        timestamp: expect.any(Number),
      });
    });

    it('should add breadcrumb with default info level', () => {
      const message = 'Test breadcrumb';

      addSentryBreadcrumb(message);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message,
        level: 'info',
        data: undefined,
        timestamp: expect.any(Number),
      });
    });

    it('should add breadcrumb with error level', () => {
      const message = 'Critical error occurred';
      const level = 'error' as const;

      addSentryBreadcrumb(message, {}, level);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message,
        level,
        data: {},
        timestamp: expect.any(Number),
      });
    });
  });

  describe('captureException', () => {
    it('should capture exception without context', () => {
      const error = new Error('Test error');

      captureException(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
      expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    it('should capture exception with context', () => {
      const error = new Error('Test error with context');
      const context = {
        deliveryId: '123',
        action: 'update_delivery',
      };

      captureException(error, context);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should handle non-Error objects', () => {
      const nonError = { message: 'Not an error object' };

      captureException(nonError);

      expect(Sentry.captureException).toHaveBeenCalledWith(nonError);
    });
  });

  describe('captureMessage', () => {
    it('should capture message with default info level', () => {
      const message = 'Test message';

      captureMessage(message);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(message, 'info');
      expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    it('should capture warning message', () => {
      const message = 'GPS accuracy below threshold';
      const level = 'warning' as const;

      captureMessage(message, level);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(message, level);
    });

    it('should capture message with context', () => {
      const message = 'Important event';
      const level = 'info' as const;
      const context = {
        userId: 'user-123',
        feature: 'tracking',
      };

      captureMessage(message, level, context);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledWith(message, level);
    });
  });

  describe('startSpan', () => {
    it('should start a performance span and execute callback', async () => {
      const name = 'calculate_mileage';
      const op = 'db.query';
      const mockResult = { distance: 100 };
      const callback = jest.fn().mockResolvedValue(mockResult);

      const result = await startSpan(name, op, callback);

      expect(Sentry.startSpan).toHaveBeenCalledWith(
        { name, op },
        callback
      );
      expect(result).toEqual(mockResult);
      expect(callback).toHaveBeenCalled();
    });

    it('should handle callback errors', async () => {
      const name = 'failing_operation';
      const op = 'http.request';
      const error = new Error('Operation failed');
      const callback = jest.fn().mockRejectedValue(error);

      await expect(startSpan(name, op, callback)).rejects.toThrow(error);
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('setSentryTags', () => {
    it('should set multiple tags', () => {
      const tags = {
        feature: 'delivery_tracking',
        environment: 'production',
        version: '1.0.0',
      };

      setSentryTags(tags);

      expect(Sentry.setTags).toHaveBeenCalledWith(tags);
    });

    it('should handle empty tags object', () => {
      setSentryTags({});

      expect(Sentry.setTags).toHaveBeenCalledWith({});
    });
  });

  describe('logErrorToSentry', () => {
    it('should log error with errorInfo context', () => {
      const error = new Error('Component error');
      const errorInfo = {
        componentStack: 'at Component',
        errorBoundary: 'ErrorBoundary',
      };

      logErrorToSentry(error, errorInfo);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should handle empty errorInfo', () => {
      const error = new Error('Error without info');

      logErrorToSentry(error, {});

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
  });
});
