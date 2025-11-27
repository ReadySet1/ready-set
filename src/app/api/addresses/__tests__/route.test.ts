/**
 * Tests for /api/addresses route
 *
 * This route is BUSINESS CRITICAL as it manages customer and business addresses
 *
 * Tests cover:
 * - GET: Fetching addresses with auth, rate limiting, pagination, filtering
 * - POST: Creating addresses with validation
 * - PUT: Updating addresses with ownership checking
 * - DELETE: Deleting addresses with ownership checking
 * - Multi-tenant data isolation (shared vs private addresses)
 * - Rate limiting enforcement
 * - Admin privilege checking
 * - Error handling
 */

import { NextRequest } from "next/server";
import { GET, POST, PUT, DELETE, __resetRateLimitForTesting } from "../route";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma-client";
import { withDatabaseRetry } from "@/utils/prismaDB";
import {
  createGetRequest,
  createPostRequest,
  createPutRequest,
  createDeleteRequest,
  createRequestWithParams,
  expectSuccessResponse,
  expectUnauthorized,
  expectValidationError,
  expectServerError,
  expectErrorResponse,
  expectForbidden,
  expectNotFound,
  createMockAddress,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies - explicitly override global jest.setup.ts mock
// Use doMock to ensure it runs after jest.setup.ts
jest.mock("@/utils/supabase/server");

jest.mock("@/lib/db/prisma-client", () => ({
  prisma: {
    address: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    userAddress: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/utils/prismaDB", () => ({
  withDatabaseRetry: jest.fn(async (callback) => await callback()),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as any;
const mockWithDatabaseRetry = withDatabaseRetry as jest.MockedFunction<typeof withDatabaseRetry>;

describe("/api/addresses", () => {
  const mockUser = {
    id: "user-id-123",
    email: "test@example.com",
  };

  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
  };

  const mockAddress = createMockAddress({
    id: "address-id-1",
    createdBy: mockUser.id,
    isShared: false,
  });

  const mockSharedAddress = createMockAddress({
    id: "shared-address-id",
    createdBy: "other-user-id",
    isShared: true,
  });

  const validAddressData = {
    street1: "123 Main St",
    street2: "Apt 4",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    county: "San Francisco",
    isRestaurant: false,
    isShared: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset rate limiting between tests
    __resetRateLimitForTesting();

    // Default: authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockCreateClient.mockResolvedValue(mockSupabase as any);

    // Default: database operations succeed
    mockPrisma.address.findMany.mockResolvedValue([]);
    mockPrisma.address.count.mockResolvedValue(0);
    mockPrisma.address.findUnique.mockResolvedValue(mockAddress);
    mockPrisma.address.create.mockResolvedValue(mockAddress);
    mockPrisma.address.update.mockResolvedValue(mockAddress);
    mockPrisma.address.delete.mockResolvedValue(mockAddress);
    mockPrisma.userAddress.findFirst.mockResolvedValue(null);
    mockPrisma.userAddress.create.mockResolvedValue({});
    mockPrisma.userAddress.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: mockUser.id, type: "CLIENT" });
    mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));
  });

  describe("GET /api/addresses", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createGetRequest("http://localhost:3000/api/addresses");
      const response = await GET(request);

      await expectUnauthorized(response);
    });

    it("should fetch addresses successfully", async () => {
      mockPrisma.address.findMany.mockResolvedValue([mockAddress]);
      mockPrisma.address.count.mockResolvedValue(1);

      const request = createGetRequest("http://localhost:3000/api/addresses");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.addresses).toHaveLength(1);
      expect(data.pagination).toBeDefined();
    });

    it("should apply rate limiting (30 requests per minute)", async () => {
      // Make 30 successful requests
      for (let i = 0; i < 30; i++) {
        const request = createGetRequest("http://localhost:3000/api/addresses");
        const response = await GET(request);
        if (i < 30) {
          expect(response.status).toBe(200);
        }
      }

      // 31st request should be rate limited
      const request = createGetRequest("http://localhost:3000/api/addresses");
      const response = await GET(request);

      const data = await expectErrorResponse(response, 429);
      expect(data.error).toContain("Rate limit exceeded");
      expect(data.retryAfter).toBeDefined();
    });

    it("should return specific address by ID", async () => {
      mockPrisma.address.findUnique.mockResolvedValue(mockAddress);

      const request = createRequestWithParams("http://localhost:3000/api/addresses", {
        id: mockAddress.id,
      });
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.id).toBe(mockAddress.id);
      expect(mockPrisma.address.findUnique).toHaveBeenCalledWith({
        where: { id: mockAddress.id },
        select: expect.any(Object),
      });
    });

    it("should return 404 when address not found", async () => {
      mockPrisma.address.findUnique.mockResolvedValue(null);

      const request = createRequestWithParams("http://localhost:3000/api/addresses", {
        id: "non-existent-id",
      });
      const response = await GET(request);

      await expectNotFound(response);
    });

    it("should return 403 when accessing private address of another user", async () => {
      const otherUserAddress = createMockAddress({
        id: "other-address-id",
        createdBy: "other-user-id",
        isShared: false,
      });

      mockPrisma.address.findUnique.mockResolvedValue(otherUserAddress);

      const request = createRequestWithParams("http://localhost:3000/api/addresses", {
        id: otherUserAddress.id,
      });
      const response = await GET(request);

      await expectForbidden(response);
    });

    it("should allow accessing shared addresses", async () => {
      mockPrisma.address.findUnique.mockResolvedValue(mockSharedAddress);

      const request = createRequestWithParams("http://localhost:3000/api/addresses", {
        id: mockSharedAddress.id,
      });
      const response = await GET(request);

      await expectSuccessResponse(response, 200);
    });

    it("should filter by 'all' (shared + user's private)", async () => {
      const request = createRequestWithParams("http://localhost:3000/api/addresses", {
        filter: "all",
      });

      await GET(request);

      expect(mockPrisma.address.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ isShared: true }, { createdBy: mockUser.id }],
          },
        })
      );
    });

    it("should filter by 'shared' only", async () => {
      const request = createRequestWithParams("http://localhost:3000/api/addresses", {
        filter: "shared",
      });

      await GET(request);

      expect(mockPrisma.address.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isShared: true },
        })
      );
    });

    it("should filter by 'private' (user's private addresses only)", async () => {
      const request = createRequestWithParams("http://localhost:3000/api/addresses", {
        filter: "private",
      });

      await GET(request);

      expect(mockPrisma.address.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdBy: mockUser.id,
            isShared: false,
          },
        })
      );
    });

    it("should apply default pagination (page 1, limit 5)", async () => {
      const request = createGetRequest("http://localhost:3000/api/addresses");
      await GET(request);

      expect(mockPrisma.address.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 5,
        })
      );
    });

    it("should support custom pagination", async () => {
      const request = createRequestWithParams("http://localhost:3000/api/addresses", {
        page: "2",
        limit: "10",
      });
      await GET(request);

      expect(mockPrisma.address.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 2 - 1) * limit 10
          take: 10,
        })
      );
    });

    it("should include pagination metadata in response", async () => {
      mockPrisma.address.findMany.mockResolvedValue([mockAddress]);
      mockPrisma.address.count.mockResolvedValue(15);

      const request = createRequestWithParams("http://localhost:3000/api/addresses", {
        page: "1",
        limit: "5",
      });
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      expect(data.pagination).toMatchObject({
        currentPage: 1,
        totalPages: 3, // 15 / 5
        totalCount: 15,
        hasNextPage: true,
        hasPrevPage: false,
        limit: 5,
      });
    });

    it("should sort by createdAt descending", async () => {
      const request = createGetRequest("http://localhost:3000/api/addresses");
      await GET(request);

      expect(mockPrisma.address.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        })
      );
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.address.findMany.mockRejectedValue(new Error("Database error"));

      const request = createGetRequest("http://localhost:3000/api/addresses");
      const response = await GET(request);

      await expectServerError(response);
    });

    it("should include cache headers", async () => {
      const request = createGetRequest("http://localhost:3000/api/addresses");
      const response = await GET(request);

      expect(response.headers.get("Cache-Control")).toBeDefined();
      expect(response.headers.get("ETag")).toBeDefined();
    });

    it("should include rate limit headers in response", async () => {
      const request = createGetRequest("http://localhost:3000/api/addresses");
      const response = await GET(request);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("30");
      expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined();
      expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
    });
  });

  describe("POST /api/addresses", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        validAddressData
      );
      const response = await POST(request);

      await expectUnauthorized(response);
    });

    it("should create address successfully", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        validAddressData
      );
      const response = await POST(request);

      const data = await expectSuccessResponse(response, 201);
      expect(data.id).toBeDefined();
    });

    it("should require street1 field", async () => {
      const { street1, ...dataWithoutStreet1 } = validAddressData;

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        dataWithoutStreet1
      );
      const response = await POST(request);

      const data = await expectValidationError(response);
      expect(data.error).toContain("Validation failed");
      expect(data.details).toContain("Street address is required");
    });

    it("should require city field", async () => {
      const { city, ...dataWithoutCity } = validAddressData;

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        dataWithoutCity
      );
      const response = await POST(request);

      const data = await expectValidationError(response);
      expect(data.details).toContain("City is required");
    });

    it("should require state field", async () => {
      const { state, ...dataWithoutState } = validAddressData;

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        dataWithoutState
      );
      const response = await POST(request);

      const data = await expectValidationError(response);
      expect(data.details).toContain("State is required");
    });

    it("should require zip field", async () => {
      const { zip, ...dataWithoutZip } = validAddressData;

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        dataWithoutZip
      );
      const response = await POST(request);

      const data = await expectValidationError(response);
      expect(data.details).toContain("ZIP code is required");
    });

    it("should require county field", async () => {
      const { county, ...dataWithoutCounty} = validAddressData;

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        dataWithoutCounty
      );
      const response = await POST(request);

      const data = await expectValidationError(response);
      expect(data.details).toContain("County is required");
    });

    it("should set createdBy to authenticated user", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        validAddressData
      );
      await POST(request);

      expect(mockPrisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          createdBy: mockUser.id,
        }),
      });
    });

    it("should normalize state to uppercase", async () => {
      const dataWithLowercaseState = {
        ...validAddressData,
        state: "ca",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        dataWithLowercaseState
      );
      await POST(request);

      expect(mockPrisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          state: "CA",
        }),
      });
    });

    it("should trim whitespace from fields", async () => {
      const dataWithWhitespace = {
        ...validAddressData,
        street1: "  123 Main St  ",
        city: "  San Francisco  ",
      };

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        dataWithWhitespace
      );
      await POST(request);

      expect(mockPrisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          street1: "123 Main St",
          city: "San Francisco",
        }),
      });
    });

    it("should create userAddress relation for private addresses", async () => {
      const privateAddressData = {
        ...validAddressData,
        isShared: false,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        privateAddressData
      );
      await POST(request);

      expect(mockPrisma.userAddress.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          addressId: expect.any(String),
        }),
      });
    });

    it("should not create userAddress relation for shared addresses", async () => {
      const sharedAddressData = {
        ...validAddressData,
        isShared: true,
      };

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        sharedAddressData
      );
      await POST(request);

      expect(mockPrisma.userAddress.create).not.toHaveBeenCalled();
    });

    it("should use database transaction for consistency", async () => {
      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        validAddressData
      );
      await POST(request);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should handle unique constraint violations", async () => {
      mockPrisma.$transaction.mockRejectedValue(
        new Error("Unique constraint failed on the fields")
      );

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        validAddressData
      );
      const response = await POST(request);

      const data = await expectErrorResponse(response, 409);
      expect(data.error).toContain("already exists");
    });

    it("should handle foreign key constraint violations", async () => {
      mockPrisma.$transaction.mockRejectedValue(
        new Error("Foreign key constraint failed on the fields")
      );

      const request = createPostRequest(
        "http://localhost:3000/api/addresses",
        validAddressData
      );
      const response = await POST(request);

      const data = await expectValidationError(response);
      expect(data.error).toContain("Invalid user reference");
    });
  });

  describe("PUT /api/addresses", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createPutRequest(
        "http://localhost:3000/api/addresses?id=address-id-1",
        { city: "Oakland" }
      );

      const response = await PUT(request);

      await expectUnauthorized(response);
    });

    it("should require id parameter", async () => {
      const request = createPutRequest(
        "http://localhost:3000/api/addresses",
        { city: "Oakland" }
      );

      const response = await PUT(request);

      const data = await expectValidationError(response);
      expect(data.error).toContain("Address ID is required");
    });

    it("should return 404 when address not found", async () => {
      mockPrisma.address.findUnique.mockResolvedValue(null);

      const request = createPutRequest(
        "http://localhost:3000/api/addresses?id=non-existent-id",
        { city: "Oakland" }
      );

      const response = await PUT(request);

      await expectNotFound(response);
    });

    it("should allow creator to update their address", async () => {
      const request = createPutRequest(
        `http://localhost:3000/api/addresses?id=${mockAddress.id}`,
        { city: "Oakland" }
      );

      const response = await PUT(request);

      await expectSuccessResponse(response, 200);
      expect(mockPrisma.address.update).toHaveBeenCalled();
    });

    it("should return 403 when non-creator tries to update", async () => {
      const otherUserAddress = createMockAddress({
        id: "other-address-id",
        createdBy: "other-user-id",
      });

      mockPrisma.address.findUnique.mockResolvedValue(otherUserAddress);
      mockPrisma.profile.findUnique.mockResolvedValue({ id: mockUser.id, type: "CLIENT" });

      const request = createPutRequest(
        `http://localhost:3000/api/addresses?id=${otherUserAddress.id}`,
        { city: "Oakland" }
      );

      const response = await PUT(request);

      await expectForbidden(response);
    });

    it("should allow admin to update any address", async () => {
      const otherUserAddress = createMockAddress({
        id: "other-address-id",
        createdBy: "other-user-id",
      });

      mockPrisma.address.findUnique.mockResolvedValue(otherUserAddress);
      mockPrisma.profile.findUnique.mockResolvedValue({ id: mockUser.id, type: "ADMIN" });

      const request = createPutRequest(
        `http://localhost:3000/api/addresses?id=${otherUserAddress.id}`,
        { city: "Oakland" }
      );

      const response = await PUT(request);

      await expectSuccessResponse(response, 200);
    });
  });

  describe("DELETE /api/addresses", () => {
    it("should return 401 when not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createDeleteRequest(
        `http://localhost:3000/api/addresses?id=${mockAddress.id}`
      );

      const response = await DELETE(request);

      await expectUnauthorized(response);
    });

    it("should require id parameter", async () => {
      const request = createDeleteRequest("http://localhost:3000/api/addresses");

      const response = await DELETE(request);

      const data = await expectValidationError(response);
      expect(data.error).toContain("Address ID is required");
    });

    it("should return 404 when address not found", async () => {
      mockPrisma.address.findUnique.mockResolvedValue(null);

      const request = createDeleteRequest(
        "http://localhost:3000/api/addresses?id=non-existent-id"
      );

      const response = await DELETE(request);

      await expectNotFound(response);
    });

    it("should allow creator to delete their address", async () => {
      const request = createDeleteRequest(
        `http://localhost:3000/api/addresses?id=${mockAddress.id}`
      );

      const response = await DELETE(request);

      await expectSuccessResponse(response, 200);
      expect(mockPrisma.userAddress.deleteMany).toHaveBeenCalledWith({
        where: { addressId: mockAddress.id },
      });
      expect(mockPrisma.address.delete).toHaveBeenCalledWith({
        where: { id: mockAddress.id },
      });
    });

    it("should return 403 when non-creator tries to delete", async () => {
      const otherUserAddress = createMockAddress({
        id: "other-address-id",
        createdBy: "other-user-id",
      });

      mockPrisma.address.findUnique.mockResolvedValue(otherUserAddress);
      mockPrisma.profile.findUnique.mockResolvedValue({ id: mockUser.id, type: "CLIENT" });

      const request = createDeleteRequest(
        `http://localhost:3000/api/addresses?id=${otherUserAddress.id}`
      );

      const response = await DELETE(request);

      await expectForbidden(response);
    });

    it("should allow admin to delete any address", async () => {
      const otherUserAddress = createMockAddress({
        id: "other-address-id",
        createdBy: "other-user-id",
      });

      mockPrisma.address.findUnique.mockResolvedValue(otherUserAddress);
      mockPrisma.profile.findUnique.mockResolvedValue({ id: mockUser.id, type: "SUPER_ADMIN" });

      const request = createDeleteRequest(
        `http://localhost:3000/api/addresses?id=${otherUserAddress.id}`
      );

      const response = await DELETE(request);

      await expectSuccessResponse(response, 200);
    });
  });
});
