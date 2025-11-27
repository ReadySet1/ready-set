/**
 * Centralized API Testing Helpers
 *
 * This module provides reusable utilities for testing API routes.
 * It includes helpers for authentication, data mocking, and response assertions.
 */

import { NextRequest } from "next/server";
import { UserType } from "@prisma/client";

// ============================================================================
// Type Definitions
// ============================================================================

export interface MockUser {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
    role?: UserType;
  };
}

export interface MockProfile {
  id: string;
  email: string;
  name: string;
  userType: UserType;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MockAddress {
  id: string;
  address: string;
  address2?: string | null;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface MockOrder {
  id: string;
  orderNumber: string;
  status: string;
  pickupDateTime: Date;
  arrivalDateTime: Date;
  orderTotal: number;
  createdAt: Date;
  userId: string;
  deletedAt: Date | null;
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Creates a mock Supabase client with authenticated user
 */
export function createMockSupabaseAuth(user: MockUser | null) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
}

/**
 * Creates a mock unauthenticated Supabase client
 */
export function createMockUnauthenticated() {
  return createMockSupabaseAuth(null);
}

/**
 * Creates a mock authenticated request with a specific user role
 */
export function createAuthenticatedRequest(
  url: string,
  userId: string = "test-user-id",
  role: UserType = "CLIENT",
  email: string = "test@example.com"
): { request: NextRequest; mockUser: MockUser } {
  const mockUser: MockUser = {
    id: userId,
    email,
    user_metadata: {
      role,
      name: `Test ${role}`,
    },
  };

  const request = new NextRequest(url);

  return { request, mockUser };
}

/**
 * Mock a user with a specific role
 */
export function mockUserByRole(role: UserType, userId: string = "test-user-id"): MockUser {
  return {
    id: userId,
    email: `${role.toLowerCase()}@example.com`,
    user_metadata: {
      role,
      name: `Test ${role}`,
    },
  };
}

// ============================================================================
// Mock Data Creators
// ============================================================================

/**
 * Creates a mock user profile
 */
export function createMockProfile(overrides?: Partial<MockProfile>): MockProfile {
  return {
    id: "profile-id",
    email: "test@example.com",
    name: "Test User",
    userType: "CLIENT",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

/**
 * Creates a mock address
 */
export function createMockAddress(overrides?: Partial<MockAddress>): MockAddress {
  return {
    id: "address-id",
    address: "123 Test St",
    address2: null,
    city: "San Francisco",
    state: "CA",
    zipCode: "94102",
    county: "San Francisco",
    latitude: 37.7749,
    longitude: -122.4194,
    ...overrides,
  };
}

/**
 * Creates a mock catering order
 */
export function createMockCateringOrder(overrides?: Partial<MockOrder>): any {
  return {
    id: "catering-order-id",
    orderNumber: "CAT001",
    status: "ACTIVE",
    pickupDateTime: new Date("2025-01-15T10:00:00Z"),
    arrivalDateTime: new Date("2025-01-15T11:00:00Z"),
    orderTotal: 150.00,
    createdAt: new Date("2025-01-15T09:00:00Z"),
    userId: "test-user-id",
    deletedAt: null,
    brokerage: true, // Identifies as catering order
    user: {
      name: "Test User",
      email: "test@example.com"
    },
    pickupAddress: createMockAddress({
      address: "123 Pickup St",
    }),
    deliveryAddress: createMockAddress({
      address: "456 Delivery Ave",
    }),
    ...overrides,
  };
}

/**
 * Creates a mock on-demand order
 */
export function createMockOnDemandOrder(overrides?: Partial<MockOrder>): any {
  return {
    id: "ondemand-order-id",
    orderNumber: "OND001",
    status: "PENDING",
    pickupDateTime: new Date("2025-01-16T10:00:00Z"),
    arrivalDateTime: new Date("2025-01-16T11:00:00Z"),
    orderTotal: 75.50,
    createdAt: new Date("2025-01-16T09:00:00Z"),
    userId: "test-user-id",
    deletedAt: null,
    user: {
      name: "Test User",
      email: "test@example.com"
    },
    pickupAddress: createMockAddress({
      address: "789 Pickup Blvd",
      city: "Oakland",
    }),
    deliveryAddress: createMockAddress({
      address: "012 Delivery Way",
      city: "Oakland",
    }),
    ...overrides,
  };
}

/**
 * Creates a mock driver
 */
export function createMockDriver(overrides?: Partial<any>): any {
  return {
    id: "driver-id",
    email: "driver@example.com",
    name: "Test Driver",
    userType: "DRIVER",
    phone: "555-0100",
    isActive: true,
    ...overrides,
  };
}

/**
 * Creates multiple mock items
 */
export function createMockArray<T>(
  count: number,
  creator: (index: number) => T
): T[] {
  return Array.from({ length: count }, (_, i) => creator(i));
}

// ============================================================================
// Response Assertion Helpers
// ============================================================================

/**
 * Asserts that a response is successful
 */
export async function expectSuccessResponse(
  response: Response,
  expectedStatus: number = 200
): Promise<any> {
  expect(response.status).toBe(expectedStatus);
  const data = await response.json();
  return data;
}

/**
 * Asserts that a response is an error
 */
export async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedMessage?: string | RegExp
): Promise<any> {
  expect(response.status).toBe(expectedStatus);
  const data = await response.json();

  if (expectedMessage) {
    if (typeof expectedMessage === 'string') {
      expect(data.message || data.error).toBe(expectedMessage);
    } else {
      expect(data.message || data.error).toMatch(expectedMessage);
    }
  }

  return data;
}

/**
 * Asserts that a response is unauthorized (401)
 */
export async function expectUnauthorized(response: Response, message?: string | RegExp): Promise<any> {
  return expectErrorResponse(response, 401, message);
}

/**
 * Asserts that a response is forbidden (403)
 */
export async function expectForbidden(response: Response, message?: string | RegExp): Promise<any> {
  return expectErrorResponse(response, 403, message);
}

/**
 * Asserts that a response has validation errors (400)
 */
export async function expectValidationError(
  response: Response,
  expectedMessage?: string | RegExp
): Promise<any> {
  return expectErrorResponse(response, 400, expectedMessage);
}

/**
 * Asserts that a response is not found (404)
 */
export async function expectNotFound(response: Response): Promise<any> {
  return expectErrorResponse(response, 404);
}

/**
 * Asserts that a response is a server error (500)
 */
export async function expectServerError(response: Response): Promise<any> {
  return expectErrorResponse(response, 500);
}

// ============================================================================
// Pagination Helpers
// ============================================================================

export interface PaginationExpectation {
  currentPage: number;
  totalPages: number;
  totalOrders?: number;
  totalItems?: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  ordersPerPage?: number;
  itemsPerPage?: number;
}

/**
 * Asserts pagination metadata
 */
export function expectPagination(
  actual: any,
  expected: PaginationExpectation
): void {
  expect(actual).toMatchObject(expected);
}

// ============================================================================
// Multi-Tenant Data Isolation Helpers
// ============================================================================

/**
 * Verifies that a query includes user ID filter for data isolation
 */
export function expectUserIdFilter(
  mockFn: jest.Mock,
  expectedUserId: string
): void {
  const calls = mockFn.mock.calls;
  expect(calls.length).toBeGreaterThan(0);

  const lastCall = calls[calls.length - 1];
  const whereClause = lastCall[0]?.where;

  expect(whereClause).toMatchObject({
    userId: expectedUserId,
  });
}

/**
 * Verifies that deleted records are filtered out
 */
export function expectDeletedFilter(mockFn: jest.Mock): void {
  const calls = mockFn.mock.calls;
  expect(calls.length).toBeGreaterThan(0);

  const lastCall = calls[calls.length - 1];
  const whereClause = lastCall[0]?.where;

  expect(whereClause?.deletedAt).toBeNull();
}

// ============================================================================
// Mock Setup Helpers
// ============================================================================

/**
 * Sets up standard Prisma mocks for testing
 */
export function setupPrismaMocks(prisma: any): void {
  // Reset all mocks
  jest.clearAllMocks();

  // Setup common mock implementations
  if (prisma.$disconnect) {
    prisma.$disconnect.mockResolvedValue(undefined);
  }
}

/**
 * Cleans up after tests
 */
export function cleanupMocks(): void {
  jest.clearAllMocks();
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Creates a NextRequest with query parameters
 */
export function createRequestWithParams(
  baseUrl: string,
  params: Record<string, string | number>
): NextRequest {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  const urlString = url.toString();
  const request = new NextRequest(urlString);
  // Ensure url property is set for the route handler
  Object.defineProperty(request, 'url', { value: urlString, writable: true });
  // Ensure nextUrl property exists and has searchParams
  if (!request.nextUrl) {
    Object.defineProperty(request, 'nextUrl', {
      value: url,
      writable: true,
      configurable: true,
    });
  }
  return request;
}

/**
 * Creates a basic GET NextRequest with proper URL
 */
export function createGetRequest(url: string, headers?: HeadersInit): NextRequest {
  const request = new NextRequest(url, { headers });
  const urlObj = new URL(url);
  // Ensure url property is set for the route handler
  Object.defineProperty(request, 'url', { value: url, writable: true });
  // Ensure nextUrl property exists and has searchParams
  if (!request.nextUrl) {
    Object.defineProperty(request, 'nextUrl', {
      value: urlObj,
      writable: true,
      configurable: true,
    });
  }
  return request;
}

/**
 * Creates a POST request with JSON body
 */
export function createPostRequest(
  url: string,
  body: any,
  additionalHeaders?: Record<string, string>
): NextRequest {
  const request = new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
    body: JSON.stringify(body),
  });
  const urlObj = new URL(url);

  // Ensure url property is set for the route handler
  Object.defineProperty(request, 'url', { value: url, writable: true });

  // Ensure nextUrl property exists and has searchParams
  if (!request.nextUrl) {
    Object.defineProperty(request, 'nextUrl', {
      value: urlObj,
      writable: true,
      configurable: true,
    });
  }

  // Override json() method to return the body data
  (request as any).json = jest.fn().mockResolvedValue(body);

  return request;
}

/**
 * Creates a POST request with FormData body
 * Use this for file upload endpoints that expect multipart/form-data
 */
export function createPostRequestWithFormData(
  url: string,
  formData: FormData,
  additionalHeaders?: Record<string, string>
): NextRequest {
  const request = new NextRequest(url, {
    method: "POST",
    headers: {
      // Don't set Content-Type for FormData - browser/fetch will set it with boundary
      ...additionalHeaders,
    },
    body: formData as any,
  });

  // Ensure url property is set for the route handler
  Object.defineProperty(request, 'url', { value: url, writable: true });

  // Mock formData() method to return the FormData object
  (request as any).formData = jest.fn().mockResolvedValue(formData);

  return request;
}

/**
 * Creates a PATCH request with JSON body
 */
export function createPatchRequest(
  url: string,
  body: any,
  additionalHeaders?: Record<string, string>
): NextRequest {
  const request = new NextRequest(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
    body: JSON.stringify(body),
  });
  const urlObj = new URL(url);

  // Ensure url property is set for the route handler
  Object.defineProperty(request, 'url', { value: url, writable: true });

  // Ensure nextUrl property exists and has searchParams
  if (!request.nextUrl) {
    Object.defineProperty(request, 'nextUrl', {
      value: urlObj,
      writable: true,
      configurable: true,
    });
  }

  // Override json() method to return the body data
  (request as any).json = jest.fn().mockResolvedValue(body);

  return request;
}

/**
 * Creates a DELETE request
 */
export function createDeleteRequest(url: string, additionalHeaders?: Record<string, string>): NextRequest {
  const request = new NextRequest(url, {
    method: "DELETE",
    headers: additionalHeaders,
  });
  const urlObj = new URL(url);
  // Ensure url property is set for the route handler
  Object.defineProperty(request, 'url', { value: url, writable: true });
  // Ensure nextUrl property exists and has searchParams
  if (!request.nextUrl) {
    Object.defineProperty(request, 'nextUrl', {
      value: urlObj,
      writable: true,
      configurable: true,
    });
  }
  return request;
}

/**
 * Creates a PUT request with JSON body and proper URL
 */
export function createPutRequest(
  url: string,
  body: any,
  additionalHeaders?: Record<string, string>
): NextRequest {
  const request = new NextRequest(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
    body: JSON.stringify(body),
  });
  const urlObj = new URL(url);

  // Ensure url property is set for the route handler
  Object.defineProperty(request, 'url', { value: url, writable: true });

  // Ensure nextUrl property exists and has searchParams
  if (!request.nextUrl) {
    Object.defineProperty(request, 'nextUrl', {
      value: urlObj,
      writable: true,
      configurable: true,
    });
  }

  // Override json() method to return the body data
  (request as any).json = jest.fn().mockResolvedValue(body);

  return request;
}
