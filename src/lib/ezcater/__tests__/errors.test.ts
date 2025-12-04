/**
 * Tests for ezCater API Error Classes
 */

import {
  EzCaterApiError,
  isEzCaterRetryableError,
  type EzCaterErrorContext,
} from '../errors';
import type { EzCaterUserError, EzCaterGraphQLResponse } from '@/types/ezcater';

describe('EzCaterApiError', () => {
  describe('constructor', () => {
    it('should create error with default values', () => {
      const error = new EzCaterApiError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(502);
      expect(error.name).toBe('EzCaterApiError');
      expect(error.context).toEqual({});
      expect(error.userErrors).toEqual([]);
      expect(error.isUserError).toBe(false);
    });

    it('should create error with custom status code', () => {
      const error = new EzCaterApiError('Test error', 503);

      expect(error.statusCode).toBe(503);
    });

    it('should create error with context', () => {
      const context: EzCaterErrorContext = {
        requestId: 'req-123',
        deliveryId: 'del-456',
        operation: 'courierAssign',
      };
      const error = new EzCaterApiError('Test error', 500, context);

      expect(error.context).toEqual(context);
    });

    it('should set isUserError to true when userErrors present', () => {
      const userErrors: EzCaterUserError[] = [
        { message: 'Invalid delivery state', path: ['deliveryId'] },
      ];
      const error = new EzCaterApiError('Test error', 422, {
        userErrors,
      });

      expect(error.userErrors).toEqual(userErrors);
      expect(error.isUserError).toBe(true);
    });
  });

  describe('fromGraphQLResponse', () => {
    it('should create error from GraphQL errors', () => {
      const response: EzCaterGraphQLResponse<unknown> = {
        errors: [
          { message: 'Syntax error' },
          { message: 'Field not found', path: ['courierAssign'] },
        ],
      };

      const error = EzCaterApiError.fromGraphQLResponse(response, {
        requestId: 'req-123',
      });

      expect(error.message).toBe('GraphQL Error: Syntax error; Field not found');
      expect(error.statusCode).toBe(502);
      expect(error.context.requestId).toBe('req-123');
      expect(error.context.graphqlErrors).toEqual(response.errors);
    });

    it('should create unknown error when no errors in response', () => {
      const response: EzCaterGraphQLResponse<unknown> = {};

      const error = EzCaterApiError.fromGraphQLResponse(response);

      expect(error.message).toBe('Unknown GraphQL error');
      expect(error.statusCode).toBe(502);
    });

    it('should create error from empty errors array', () => {
      const response: EzCaterGraphQLResponse<unknown> = {
        errors: [],
      };

      const error = EzCaterApiError.fromGraphQLResponse(response);

      expect(error.message).toBe('Unknown GraphQL error');
    });
  });

  describe('fromUserErrors', () => {
    it('should create error from user errors', () => {
      const userErrors: EzCaterUserError[] = [
        { message: 'Delivery not found', path: ['deliveryId'] },
        { message: 'Courier already assigned' },
      ];

      const error = EzCaterApiError.fromUserErrors(userErrors, {
        operation: 'courierAssign',
        deliveryId: 'del-123',
      });

      expect(error.message).toBe(
        'Business Logic Error: Delivery not found; Courier already assigned'
      );
      expect(error.statusCode).toBe(422);
      expect(error.isUserError).toBe(true);
      expect(error.userErrors).toEqual(userErrors);
      expect(error.context.operation).toBe('courierAssign');
      expect(error.context.deliveryId).toBe('del-123');
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const userErrors: EzCaterUserError[] = [
        { message: 'Test error', path: ['field'] },
      ];
      const error = new EzCaterApiError('Test message', 422, {
        requestId: 'req-123',
        userErrors,
      });

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'EzCaterApiError',
        message: 'Test message',
        statusCode: 422,
        context: {
          requestId: 'req-123',
          userErrors,
        },
        userErrors,
        isUserError: true,
      });
    });
  });
});

describe('isEzCaterRetryableError', () => {
  it('should return false for user errors', () => {
    const error = new EzCaterApiError('Business error', 422, {
      userErrors: [{ message: 'Invalid state' }],
    });

    expect(isEzCaterRetryableError(error)).toBe(false);
  });

  it('should return false for 4xx errors except 429', () => {
    expect(isEzCaterRetryableError(new EzCaterApiError('Bad request', 400))).toBe(
      false
    );
    expect(isEzCaterRetryableError(new EzCaterApiError('Unauthorized', 401))).toBe(
      false
    );
    expect(isEzCaterRetryableError(new EzCaterApiError('Forbidden', 403))).toBe(
      false
    );
    expect(isEzCaterRetryableError(new EzCaterApiError('Not found', 404))).toBe(
      false
    );
  });

  it('should return true for 429 rate limiting', () => {
    const error = new EzCaterApiError('Rate limited', 429);

    expect(isEzCaterRetryableError(error)).toBe(true);
  });

  it('should return true for 5xx errors', () => {
    expect(
      isEzCaterRetryableError(new EzCaterApiError('Server error', 500))
    ).toBe(true);
    expect(isEzCaterRetryableError(new EzCaterApiError('Bad gateway', 502))).toBe(
      true
    );
    expect(
      isEzCaterRetryableError(new EzCaterApiError('Service unavailable', 503))
    ).toBe(true);
  });

  it('should return true for unknown errors', () => {
    expect(isEzCaterRetryableError(new Error('Unknown'))).toBe(true);
    expect(isEzCaterRetryableError('string error')).toBe(true);
    expect(isEzCaterRetryableError(null)).toBe(true);
    expect(isEzCaterRetryableError(undefined)).toBe(true);
  });
});
