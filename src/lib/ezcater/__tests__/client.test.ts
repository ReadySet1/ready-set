/**
 * Tests for ezCater GraphQL Client
 */

import { GraphQLClient, ClientError } from 'graphql-request';
import { executeQuery, checkMutationResponse, resetClient } from '../client';
import { EzCaterApiError } from '../errors';
import type { EzCaterMutationResponse } from '@/types/ezcater';

// Mock graphql-request
jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
  ClientError: class MockClientError extends Error {
    response: any;
    constructor(response: any) {
      super('GraphQL Error');
      this.response = response;
    }
  },
}));

// Mock config
jest.mock('@/config/ezcater', () => ({
  getEzCaterApiUrl: jest.fn(() => 'https://api.ezcater.com/graphql'),
  getEzCaterHeaders: jest.fn(() => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
    'apollographql-client-name': 'ready-set',
    'apollographql-client-version': '1.0.0',
  })),
  validateEzCaterConfig: jest.fn(),
  isEzCaterEnabled: jest.fn(() => true),
}));

// Mock logger
jest.mock('@/utils/logger', () => ({
  ezCaterLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock resilience
jest.mock('../resilience', () => ({
  withEzCaterResilience: jest.fn((operation) => operation()),
}));

describe('executeQuery', () => {
  let mockRequest: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    resetClient();

    // Get the mock request function
    mockRequest = jest.fn();
    (GraphQLClient as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));
  });

  it('should execute query successfully', async () => {
    const mockResponse = {
      courierAssign: {
        clientMutationId: 'mut-123',
        delivery: { id: 'del-456' },
        userErrors: [],
      },
    };
    mockRequest.mockResolvedValue(mockResponse);

    const result = await executeQuery(
      'mutation { courierAssign }',
      { input: { deliveryId: 'del-123' } },
      { operationName: 'courierAssign' }
    );

    expect(result).toEqual(mockResponse);
    expect(mockRequest).toHaveBeenCalledWith('mutation { courierAssign }', {
      input: { deliveryId: 'del-123' },
    });
  });

  it('should throw EzCaterApiError when not enabled', async () => {
    const { isEzCaterEnabled } = require('@/config/ezcater');
    isEzCaterEnabled.mockReturnValue(false);

    await expect(executeQuery('query { test }')).rejects.toThrow(EzCaterApiError);
    await expect(executeQuery('query { test }')).rejects.toMatchObject({
      message: expect.stringContaining('not enabled'),
      statusCode: 503,
    });

    isEzCaterEnabled.mockReturnValue(true);
  });

  it('should handle GraphQL ClientError', async () => {
    const graphqlError = new (require('graphql-request').ClientError)({
      status: 400,
      errors: [{ message: 'Syntax error' }],
    });
    mockRequest.mockRejectedValue(graphqlError);

    await expect(
      executeQuery('invalid query', undefined, { operationName: 'test' })
    ).rejects.toThrow(EzCaterApiError);
  });

  it('should handle generic errors', async () => {
    mockRequest.mockRejectedValue(new Error('Network error'));

    await expect(executeQuery('query { test }')).rejects.toThrow(EzCaterApiError);
    await expect(executeQuery('query { test }')).rejects.toMatchObject({
      message: 'Network error',
      statusCode: 502,
    });
  });

  it('should skip resilience when option is set', async () => {
    const { withEzCaterResilience } = require('../resilience');
    mockRequest.mockResolvedValue({ data: 'test' });

    await executeQuery('query { test }', undefined, { skipResilience: true });

    expect(withEzCaterResilience).not.toHaveBeenCalled();
  });

  it('should use custom request ID when provided', async () => {
    const { ezCaterLogger } = require('@/utils/logger');
    mockRequest.mockResolvedValue({ data: 'test' });

    await executeQuery('query { test }', undefined, {
      requestId: 'custom-req-id',
      operationName: 'testOp',
    });

    expect(ezCaterLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('testOp'),
      expect.objectContaining({ requestId: 'custom-req-id' })
    );
  });

  it('should sanitize phone numbers in logs', async () => {
    const { ezCaterLogger } = require('@/utils/logger');
    mockRequest.mockResolvedValue({ data: 'test' });

    await executeQuery(
      'mutation { test }',
      {
        input: {
          deliveryId: 'del-123',
          courier: {
            id: 'driver-456',
            phone: '+1234567890',
          },
        },
      },
      { operationName: 'courierAssign' }
    );

    // Check that the logged variables have redacted phone
    expect(ezCaterLogger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({
            courier: expect.objectContaining({
              phone: '[REDACTED]',
            }),
          }),
        }),
      })
    );
  });
});

describe('checkMutationResponse', () => {
  it('should not throw when userErrors is empty', () => {
    const response: EzCaterMutationResponse = {
      clientMutationId: 'mut-123',
      delivery: { id: 'del-456' },
      userErrors: [],
    };

    expect(() => checkMutationResponse(response)).not.toThrow();
  });

  it('should throw EzCaterApiError when userErrors present', () => {
    const response: EzCaterMutationResponse = {
      clientMutationId: 'mut-123',
      userErrors: [
        { message: 'Delivery not found', path: ['deliveryId'] },
      ],
    };

    expect(() =>
      checkMutationResponse(response, {
        operation: 'courierAssign',
        deliveryId: 'del-123',
      })
    ).toThrow(EzCaterApiError);
  });

  it('should include context in thrown error', () => {
    const response: EzCaterMutationResponse = {
      userErrors: [{ message: 'Invalid state' }],
    };

    try {
      checkMutationResponse(response, {
        requestId: 'req-123',
        operation: 'courierAssign',
        deliveryId: 'del-456',
      });
      fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EzCaterApiError);
      const apiError = error as EzCaterApiError;
      expect(apiError.context.operation).toBe('courierAssign');
      expect(apiError.context.deliveryId).toBe('del-456');
      expect(apiError.isUserError).toBe(true);
    }
  });
});

describe('resetClient', () => {
  it('should reset the client instance', async () => {
    const mockRequest = jest.fn().mockResolvedValue({ data: 'test' });
    (GraphQLClient as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));

    // First call creates client
    await executeQuery('query { test }', undefined, { skipResilience: true });
    expect(GraphQLClient).toHaveBeenCalledTimes(1);

    // Second call uses cached client
    await executeQuery('query { test }', undefined, { skipResilience: true });
    expect(GraphQLClient).toHaveBeenCalledTimes(1);

    // Reset and call again
    resetClient();
    await executeQuery('query { test }', undefined, { skipResilience: true });
    expect(GraphQLClient).toHaveBeenCalledTimes(2);
  });
});
