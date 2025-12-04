/**
 * Tests for ezCater Typed Operations
 */

import {
  courierAssign,
  courierUnassign,
  courierEventCreate,
  courierTrackingEventCreate,
  courierImagesCreate,
  couriersAssign,
} from '../operations';
import { EzCaterApiError } from '../errors';
import type {
  EzCaterCourierAssignInput,
  EzCaterCourierEventCreateInput,
  EzCaterCourierTrackingEventCreateInput,
} from '@/types/ezcater';

// Mock the client module
jest.mock('../client', () => ({
  executeQuery: jest.fn(),
  checkMutationResponse: jest.fn(),
}));

const { executeQuery, checkMutationResponse } = require('../client');

describe('courierAssign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call executeQuery with correct arguments', async () => {
    const input: EzCaterCourierAssignInput = {
      deliveryId: 'del-123',
      courier: {
        id: 'driver-456',
        firstName: 'John',
        lastName: 'Doe',
      },
    };
    const mockResponse = {
      courierAssign: {
        clientMutationId: 'mut-123',
        delivery: { id: 'del-123' },
        userErrors: [],
      },
    };
    executeQuery.mockResolvedValue(mockResponse);

    const result = await courierAssign(input);

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('CourierAssign'),
      { input },
      { operationName: 'courierAssign' }
    );
    expect(checkMutationResponse).toHaveBeenCalledWith(
      mockResponse.courierAssign,
      expect.objectContaining({
        operation: 'courierAssign',
        deliveryId: 'del-123',
      })
    );
    expect(result).toEqual(mockResponse.courierAssign);
  });

  it('should throw when checkMutationResponse throws', async () => {
    const input: EzCaterCourierAssignInput = {
      deliveryId: 'del-123',
      courier: { id: 'driver-456' },
    };
    const mockResponse = {
      courierAssign: {
        userErrors: [{ message: 'Invalid delivery' }],
      },
    };
    executeQuery.mockResolvedValue(mockResponse);
    checkMutationResponse.mockImplementation(() => {
      throw new EzCaterApiError('Business Logic Error', 422, {
        userErrors: [{ message: 'Invalid delivery' }],
      });
    });

    await expect(courierAssign(input)).rejects.toThrow(EzCaterApiError);
  });
});

describe('courierUnassign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkMutationResponse.mockImplementation(() => {});
  });

  it('should call executeQuery with correct arguments', async () => {
    const input = { deliveryId: 'del-123' };
    const mockResponse = {
      courierUnassign: {
        clientMutationId: 'mut-123',
        delivery: { id: 'del-123' },
        userErrors: [],
      },
    };
    executeQuery.mockResolvedValue(mockResponse);

    const result = await courierUnassign(input);

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('CourierUnassign'),
      { input },
      { operationName: 'courierUnassign' }
    );
    expect(result).toEqual(mockResponse.courierUnassign);
  });
});

describe('courierEventCreate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkMutationResponse.mockImplementation(() => {});
  });

  it('should call executeQuery with correct arguments', async () => {
    const input: EzCaterCourierEventCreateInput = {
      deliveryId: 'del-123',
      eventType: 'ORDER_PICKED_UP',
      occurredAt: '2024-01-15T10:30:00Z',
      courier: { id: 'driver-456' },
    };
    const mockResponse = {
      courierEventCreate: {
        clientMutationId: 'mut-123',
        delivery: { id: 'del-123' },
        userErrors: [],
      },
    };
    executeQuery.mockResolvedValue(mockResponse);

    const result = await courierEventCreate(input);

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('CourierEventCreate'),
      { input },
      { operationName: 'courierEventCreate' }
    );
    expect(result).toEqual(mockResponse.courierEventCreate);
  });
});

describe('courierTrackingEventCreate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkMutationResponse.mockImplementation(() => {});
  });

  it('should call executeQuery with correct arguments', async () => {
    const input: EzCaterCourierTrackingEventCreateInput = {
      deliveryId: 'del-123',
      courier: { id: 'driver-456' },
      coordinates: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
      occurredAt: '2024-01-15T10:30:00Z',
    };
    const mockResponse = {
      courierTrackingEventCreate: {
        clientMutationId: 'mut-123',
        delivery: { id: 'del-123' },
        userErrors: [],
      },
    };
    executeQuery.mockResolvedValue(mockResponse);

    const result = await courierTrackingEventCreate(input);

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('CourierTrackingEventCreate'),
      { input },
      { operationName: 'courierTrackingEventCreate' }
    );
    expect(result).toEqual(mockResponse.courierTrackingEventCreate);
  });
});

describe('courierImagesCreate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkMutationResponse.mockImplementation(() => {});
  });

  it('should call executeQuery with correct arguments', async () => {
    const input = {
      deliveryId: 'del-123',
      images: [{ url: 'https://example.com/photo.jpg' }],
    };
    const mockResponse = {
      courierImagesCreate: {
        clientMutationId: 'mut-123',
        delivery: { id: 'del-123' },
        userErrors: [],
      },
    };
    executeQuery.mockResolvedValue(mockResponse);

    const result = await courierImagesCreate(input);

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('CourierImagesCreate'),
      { input },
      { operationName: 'courierImagesCreate' }
    );
    expect(result).toEqual(mockResponse.courierImagesCreate);
  });
});

describe('couriersAssign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    checkMutationResponse.mockImplementation(() => {});
  });

  it('should call executeQuery with correct arguments', async () => {
    const input = {
      assignments: [
        { deliveryId: 'del-1', courier: { id: 'driver-1' } },
        { deliveryId: 'del-2', courier: { id: 'driver-2' } },
      ],
    };
    const mockResponse = {
      couriersAssign: {
        clientMutationId: 'mut-123',
        deliveries: [{ id: 'del-1' }, { id: 'del-2' }],
        userErrors: [],
      },
    };
    executeQuery.mockResolvedValue(mockResponse);

    const result = await couriersAssign(input);

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('CouriersAssign'),
      { input },
      { operationName: 'couriersAssign' }
    );
    expect(result).toEqual(mockResponse.couriersAssign);
  });
});
