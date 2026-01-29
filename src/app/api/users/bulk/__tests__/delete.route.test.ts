/**
 * API Route Tests for POST /api/users/bulk/delete
 *
 * Tests for bulk soft delete endpoint with NextRequest/NextResponse patterns
 */

import { POST } from "../delete/route";
import { UserType } from "@/types/prisma";
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
const mockBulkSoftDelete = jest.fn();
jest.mock("@/services/userBulkOperationsService", () => ({
  userBulkOperationsService: {
    bulkSoftDelete: (...args: unknown[]) => mockBulkSoftDelete(...args),
  },
}));

describe("POST /api/users/bulk/delete", () => {
  const validUUID1 = "12345678-1234-1234-1234-123456789012";
  const validUUID2 = "87654321-4321-4321-4321-210987654321";
  const adminId = "aaaaaaaa-1234-1234-1234-123456789012";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [validUUID1],
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
        type: UserType.DRIVER,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [validUUID1],
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
      mockBulkSoftDelete.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [validUUID1],
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
      mockBulkSoftDelete.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [validUUID1],
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
      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: "single-id",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("userIds must be a non-empty array");
    });

    it("should return 400 when userIds is empty", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("userIds must be a non-empty array");
    });

    it("should return 400 when user ID format is invalid", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: ["not-a-uuid-format"],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid user ID format");
    });

    it("should return 400 when trying to delete own account", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [adminId],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Cannot delete your own account");
    });

    it("should return 400 when own ID is in the list with others", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [validUUID1, adminId, validUUID2],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Cannot delete your own account");
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

    it("should successfully soft delete multiple users", async () => {
      mockBulkSoftDelete.mockResolvedValue({
        success: [validUUID1, validUUID2],
        failed: [],
        totalProcessed: 2,
        totalSuccess: 2,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [validUUID1, validUUID2],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results.totalSuccess).toBe(2);
      expect(data.results.totalFailed).toBe(0);
      expect(mockBulkSoftDelete).toHaveBeenCalledWith(
        {
          userIds: [validUUID1, validUUID2],
          reason: undefined,
        },
        adminId
      );
    });

    it("should include reason when provided", async () => {
      mockBulkSoftDelete.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [validUUID1],
        reason: "Inactive for 6 months",
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockBulkSoftDelete).toHaveBeenCalledWith(
        {
          userIds: [validUUID1],
          reason: "Inactive for 6 months",
        },
        adminId
      );
    });

    it("should handle partial failures", async () => {
      mockBulkSoftDelete.mockResolvedValue({
        success: [validUUID1],
        failed: [{ userId: validUUID2, reason: "Has active orders" }],
        totalProcessed: 2,
        totalSuccess: 1,
        totalFailed: 1,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [validUUID1, validUUID2],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain("1 succeeded");
      expect(data.message).toContain("1 failed");
      expect(data.results.failed[0].reason).toBe("Has active orders");
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
      mockBulkSoftDelete.mockRejectedValue(new Error("Transaction failed"));

      const req = createPostRequest("http://localhost:3000/api/users/bulk/delete", {
        userIds: [validUUID1],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to perform bulk delete");
      expect(data.details).toBe("Transaction failed");
    });
  });
});
