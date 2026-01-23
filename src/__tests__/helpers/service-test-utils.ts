/**
 * Service Test Utilities
 *
 * Extended utilities for testing service layer modules.
 * Provides common scenario configurators and assertion helpers.
 *
 * Part of REA-315: Service Layer Unit Tests
 */

import {
  MockPrismaClient,
  MockPrismaModel,
  configureMockModel,
  MockPrismaError,
  PrismaErrorCodes,
} from './prisma-mock-helpers';
import {
  createMockProfile,
  createMockCateringRequest,
  createMockOnDemand,
  createMockAddress,
  createMockDispatch,
  createMockFileUpload,
  createMockUserAudit,
  createMockDeletedProfile,
  MockProfile,
  MockCateringRequest,
  MockOnDemand,
} from './mock-data-factories';
import { UserType, UserStatus, CateringStatus, OnDemandStatus } from '@/types/prisma';

// ============================================================================
// Scenario Configurators
// ============================================================================

/**
 * Configure mock for user exists scenario
 */
export function configureUserExists(
  prisma: MockPrismaClient,
  user: Partial<MockProfile> = {}
): MockProfile {
  const mockUser = createMockProfile(user);
  prisma.profile.findUnique.mockResolvedValue(mockUser);
  return mockUser;
}

/**
 * Configure mock for user not found scenario
 */
export function configureUserNotFound(prisma: MockPrismaClient): void {
  prisma.profile.findUnique.mockResolvedValue(null);
}

/**
 * Configure mock for user already deleted scenario
 */
export function configureUserAlreadyDeleted(
  prisma: MockPrismaClient,
  user: Partial<MockProfile> = {}
): MockProfile {
  const mockUser = createMockDeletedProfile(user);
  prisma.profile.findUnique.mockResolvedValue(mockUser);
  return mockUser;
}

/**
 * Configure mock for user with active orders scenario
 */
export function configureUserWithActiveOrders(
  prisma: MockPrismaClient,
  cateringCount: number = 1,
  onDemandCount: number = 0
): void {
  prisma.cateringRequest.count.mockResolvedValue(cateringCount);
  prisma.onDemand.count.mockResolvedValue(onDemandCount);
}

/**
 * Configure mock for user without active orders scenario
 */
export function configureUserWithoutActiveOrders(prisma: MockPrismaClient): void {
  prisma.cateringRequest.count.mockResolvedValue(0);
  prisma.onDemand.count.mockResolvedValue(0);
}

/**
 * Configure mock for successful transaction
 */
export function configureSuccessfulTransaction(
  prisma: MockPrismaClient,
  result: any = {}
): void {
  prisma.$transaction.mockImplementation(async (fnOrArray) => {
    if (typeof fnOrArray === 'function') {
      return fnOrArray(prisma);
    }
    return Promise.all(fnOrArray);
  });
}

/**
 * Configure mock for transaction failure
 */
export function configureTransactionFailure(
  prisma: MockPrismaClient,
  error: Error = new Error('Transaction failed')
): void {
  prisma.$transaction.mockRejectedValue(error);
}

/**
 * Configure mock for profile update success
 */
export function configureProfileUpdateSuccess(
  prisma: MockPrismaClient,
  updatedProfile: Partial<MockProfile> = {}
): MockProfile {
  const mockProfile = createMockProfile(updatedProfile);
  prisma.profile.update.mockResolvedValue(mockProfile);
  return mockProfile;
}

/**
 * Configure mock for profile delete success
 */
export function configureProfileDeleteSuccess(
  prisma: MockPrismaClient,
  deletedProfile: Partial<MockProfile> = {}
): MockProfile {
  const mockProfile = createMockProfile(deletedProfile);
  prisma.profile.delete.mockResolvedValue(mockProfile);
  return mockProfile;
}

/**
 * Configure mock for audit log creation
 */
export function configureAuditLogSuccess(prisma: MockPrismaClient): void {
  prisma.userAudit.create.mockResolvedValue(createMockUserAudit());
}

/**
 * Configure mock for finding many users
 */
export function configureFindManyUsers(
  prisma: MockPrismaClient,
  users: MockProfile[],
  count?: number
): void {
  prisma.profile.findMany.mockResolvedValue(users);
  prisma.profile.count.mockResolvedValue(count ?? users.length);
}

/**
 * Configure mock for catering orders
 */
export function configureCateringOrders(
  prisma: MockPrismaClient,
  orders: MockCateringRequest[]
): void {
  prisma.cateringRequest.findMany.mockResolvedValue(orders);
  prisma.cateringRequest.count.mockResolvedValue(orders.length);
}

/**
 * Configure mock for on-demand orders
 */
export function configureOnDemandOrders(
  prisma: MockPrismaClient,
  orders: MockOnDemand[]
): void {
  prisma.onDemand.findMany.mockResolvedValue(orders);
  prisma.onDemand.count.mockResolvedValue(orders.length);
}

/**
 * Configure mock for aggregate query
 */
export function configureAggregate(
  prisma: MockPrismaClient,
  model: keyof MockPrismaClient,
  result: any
): void {
  const mockModel = prisma[model] as unknown as MockPrismaModel;
  if (mockModel && mockModel.aggregate) {
    mockModel.aggregate.mockResolvedValue(result);
  }
}

/**
 * Configure mock for groupBy query
 */
export function configureGroupBy(
  prisma: MockPrismaClient,
  model: keyof MockPrismaClient,
  result: any[]
): void {
  const mockModel = prisma[model] as unknown as MockPrismaModel;
  if (mockModel && mockModel.groupBy) {
    mockModel.groupBy.mockResolvedValue(result);
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a transaction was called with a callback function
 */
export function expectTransactionCalled(prisma: MockPrismaClient): void {
  expect(prisma.$transaction).toHaveBeenCalled();
}

/**
 * Assert that an audit log was created with specific action
 */
export function expectAuditLogCreated(
  prisma: MockPrismaClient,
  action: string,
  userId?: string
): void {
  expect(prisma.userAudit.create).toHaveBeenCalled();
  const createCall = prisma.userAudit.create.mock.calls[0][0];
  expect(createCall.data.action).toBe(action);
  if (userId) {
    expect(createCall.data.userId).toBe(userId);
  }
}

/**
 * Assert that profile was updated with soft delete fields
 */
export function expectSoftDeleteApplied(
  prisma: MockPrismaClient,
  userId: string,
  deletedBy: string
): void {
  expect(prisma.profile.update).toHaveBeenCalled();
  const updateCall = prisma.profile.update.mock.calls[0][0];
  expect(updateCall.where.id).toBe(userId);
  expect(updateCall.data.deletedAt).toBeDefined();
  expect(updateCall.data.deletedBy).toBe(deletedBy);
}

/**
 * Assert that profile was restored (soft delete fields cleared)
 */
export function expectRestoreApplied(
  prisma: MockPrismaClient,
  userId: string
): void {
  expect(prisma.profile.update).toHaveBeenCalled();
  const updateCall = prisma.profile.update.mock.calls[0][0];
  expect(updateCall.where.id).toBe(userId);
  expect(updateCall.data.deletedAt).toBeNull();
  expect(updateCall.data.deletedBy).toBeNull();
}

// ============================================================================
// External API Mock Helpers
// ============================================================================

/**
 * Mock fetch response
 */
export function createMockFetchResponse(
  body: any,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
): Response {
  const { ok = true, status = 200, statusText = 'OK' } = options;

  return {
    ok,
    status,
    statusText,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    headers: new Headers(),
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    redirected: false,
    type: 'basic',
    url: '',
  } as unknown as Response;
}

/**
 * Configure global fetch mock for success
 */
export function configureFetchSuccess(body: any): jest.Mock {
  const mockFetch = jest.fn().mockResolvedValue(createMockFetchResponse(body));
  global.fetch = mockFetch;
  return mockFetch;
}

/**
 * Configure global fetch mock for error
 */
export function configureFetchError(
  status: number,
  body: any = {},
  statusText: string = 'Error'
): jest.Mock {
  const mockFetch = jest.fn().mockResolvedValue(
    createMockFetchResponse(body, { ok: false, status, statusText })
  );
  global.fetch = mockFetch;
  return mockFetch;
}

/**
 * Configure global fetch mock for network error
 */
export function configureFetchNetworkError(error: Error = new Error('Network error')): jest.Mock {
  const mockFetch = jest.fn().mockRejectedValue(error);
  global.fetch = mockFetch;
  return mockFetch;
}

// ============================================================================
// Toast Mock Helpers
// ============================================================================

/**
 * Create mock toast functions
 */
export function createMockToast() {
  return {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
    custom: jest.fn(),
    promise: jest.fn(),
    // Default toast function
    __esModule: true,
    default: jest.fn(),
  };
}

// ============================================================================
// CaterValley Specific Helpers
// ============================================================================

/**
 * Create CaterValley success response
 */
export function createCaterValleySuccessResponse() {
  return {
    result: true,
    message: 'Status updated successfully',
    data: {},
  };
}

/**
 * Create CaterValley error response
 */
export function createCaterValleyErrorResponse(message: string = 'Error') {
  return {
    result: false,
    message,
    data: {},
  };
}

/**
 * Configure fetch for CaterValley success
 */
export function configureCaterValleySuccess(): jest.Mock {
  return configureFetchSuccess(createCaterValleySuccessResponse());
}

/**
 * Configure fetch for CaterValley 404 (order not found)
 */
export function configureCaterValleyNotFound(): jest.Mock {
  return configureFetchError(404, { message: 'Order not found' }, 'Not Found');
}

/**
 * Configure fetch for CaterValley server error
 */
export function configureCaterValleyServerError(): jest.Mock {
  return configureFetchError(500, { message: 'Internal server error' }, 'Internal Server Error');
}

// ============================================================================
// Google Maps Specific Helpers
// ============================================================================

/**
 * Create Google Maps Distance Matrix success response
 */
export function createGoogleMapsDistanceResponse(distanceMiles: number) {
  const distanceMeters = Math.round(distanceMiles / 0.000621371);
  return {
    status: 'OK',
    rows: [
      {
        elements: [
          {
            status: 'OK',
            distance: {
              text: `${distanceMiles.toFixed(1)} mi`,
              value: distanceMeters,
            },
            duration: {
              text: `${Math.round(distanceMiles * 2)} mins`,
              value: Math.round(distanceMiles * 2 * 60),
            },
          },
        ],
      },
    ],
  };
}

/**
 * Create Google Maps error response
 */
export function createGoogleMapsErrorResponse(status: string = 'ZERO_RESULTS') {
  return {
    status,
    rows: [
      {
        elements: [
          {
            status: 'ZERO_RESULTS',
          },
        ],
      },
    ],
  };
}

/**
 * Configure fetch for Google Maps Distance Matrix success
 */
export function configureGoogleMapsSuccess(distanceMiles: number): jest.Mock {
  return configureFetchSuccess(createGoogleMapsDistanceResponse(distanceMiles));
}

/**
 * Configure fetch for Google Maps error
 */
export function configureGoogleMapsError(status: string = 'ZERO_RESULTS'): jest.Mock {
  return configureFetchSuccess(createGoogleMapsErrorResponse(status));
}

// ============================================================================
// Reset Helpers
// ============================================================================

/**
 * Reset all common mocks
 */
export function resetAllMocks(): void {
  jest.clearAllMocks();
  if (global.fetch) {
    (global.fetch as jest.Mock).mockReset?.();
  }
}

/**
 * Setup environment variables for testing
 */
export function setupTestEnv(env: Record<string, string | undefined>): () => void {
  const originalEnv = { ...process.env };

  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  // Return cleanup function
  return () => {
    Object.keys(env).forEach(key => {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    });
  };
}
