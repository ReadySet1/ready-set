/**
 * API Route Tests for POST /api/users/bulk/status
 *
 * Tests for bulk status change endpoint with NextRequest/NextResponse patterns
 */

import { POST } from "../status/route";
import { UserType, UserStatus } from "@/types/prisma";
import { createPostRequest } from "@/__tests__/helpers/api-test-helpers";

// Mock Supabase
const mockGetUser = jest.fn();
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn().mockImplementation(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
    })
  ),
}));

// Mock Prisma
const mockProfileFindUnique = jest.fn();
jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
    },
  },
}));

// Mock the bulk operations service
const mockBulkStatusChange = jest.fn();
jest.mock("@/services/userBulkOperationsService", () => ({
  userBulkOperationsService: {
    bulkStatusChange: (...args: unknown[]) => mockBulkStatusChange(...args),
  },
}));

describe("POST /api/users/bulk/status", () => {
  const validUUID1 = "12345678-1234-1234-1234-123456789012";
  const validUUID2 = "87654321-4321-4321-4321-210987654321";
  const adminId = "aaaaaaaa-1234-1234-1234-123456789012";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [validUUID1],
        status: UserStatus.ACTIVE,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });
  });

  describe("Authorization", () => {
    it("should return 403 when user is not admin", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.CLIENT,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [validUUID1],
        status: UserStatus.ACTIVE,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Forbidden");
    });

    it("should allow ADMIN users", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
      mockBulkStatusChange.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [validUUID1],
        status: UserStatus.ACTIVE,
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
    });

    it("should allow SUPER_ADMIN users", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });
      mockBulkStatusChange.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [validUUID1],
        status: UserStatus.ACTIVE,
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });

  describe("Request Validation", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should return 400 when userIds is not an array", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: "not-an-array",
        status: UserStatus.ACTIVE,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("userIds must be a non-empty array");
    });

    it("should return 400 when userIds is empty", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [],
        status: UserStatus.ACTIVE,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("userIds must be a non-empty array");
    });

    it("should return 400 when status is invalid", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [validUUID1],
        status: "INVALID_STATUS",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid status");
    });

    it("should return 400 when status is missing", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [validUUID1],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid status");
    });

    it("should return 400 when user ID format is invalid", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: ["invalid-uuid"],
        status: UserStatus.ACTIVE,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid user ID format");
    });
  });

  describe("Successful Operations", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should successfully change status for multiple users", async () => {
      mockBulkStatusChange.mockResolvedValue({
        success: [validUUID1, validUUID2],
        failed: [],
        totalProcessed: 2,
        totalSuccess: 2,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [validUUID1, validUUID2],
        status: UserStatus.ACTIVE,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results.totalSuccess).toBe(2);
      expect(data.results.totalFailed).toBe(0);
      expect(mockBulkStatusChange).toHaveBeenCalledWith(
        {
          userIds: [validUUID1, validUUID2],
          status: UserStatus.ACTIVE,
          reason: undefined,
        },
        adminId
      );
    });

    it("should include reason when provided", async () => {
      mockBulkStatusChange.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [validUUID1],
        status: UserStatus.PENDING,
        reason: "Account review required",
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockBulkStatusChange).toHaveBeenCalledWith(
        {
          userIds: [validUUID1],
          status: UserStatus.PENDING,
          reason: "Account review required",
        },
        adminId
      );
    });

    it("should handle partial failures", async () => {
      mockBulkStatusChange.mockResolvedValue({
        success: [validUUID1],
        failed: [{ userId: validUUID2, reason: "User not found" }],
        totalProcessed: 2,
        totalSuccess: 1,
        totalFailed: 1,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [validUUID1, validUUID2],
        status: UserStatus.ACTIVE,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain("1 succeeded");
      expect(data.message).toContain("1 failed");
      expect(data.results.totalSuccess).toBe(1);
      expect(data.results.totalFailed).toBe(1);
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should return 500 when service throws an error", async () => {
      mockBulkStatusChange.mockRejectedValue(new Error("Database connection failed"));

      const req = createPostRequest("http://localhost:3000/api/users/bulk/status", {
        userIds: [validUUID1],
        status: UserStatus.ACTIVE,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to perform bulk status change");
      expect(data.details).toBe("Database connection failed");
    });
  });
});
