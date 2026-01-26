/**
 * API Route Tests for POST /api/users/bulk/restore
 *
 * Tests for bulk restore endpoint with NextRequest/NextResponse patterns
 */

import { POST } from "../restore/route";
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
const mockBulkRestore = jest.fn();
jest.mock("@/services/userBulkOperationsService", () => ({
  userBulkOperationsService: {
    bulkRestore: (...args: unknown[]) => mockBulkRestore(...args),
  },
}));

describe("POST /api/users/bulk/restore", () => {
  const validUUID1 = "12345678-1234-1234-1234-123456789012";
  const validUUID2 = "87654321-4321-4321-4321-210987654321";
  const validUUID3 = "abcdefab-1234-5678-9012-abcdefabcdef";
  const adminId = "aaaaaaaa-1234-1234-1234-123456789012";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
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
        type: UserType.VENDOR,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: [validUUID1],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Forbidden");
    });

    it("should return 403 when user profile not found", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue(null);

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
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
      mockBulkRestore.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
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
      mockBulkRestore.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
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
      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: validUUID1,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("userIds must be a non-empty array");
    });

    it("should return 400 when userIds is empty", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: [],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("userIds must be a non-empty array");
    });

    it("should return 400 when user ID format is invalid", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: ["short-id"],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid user ID format");
    });

    it("should return 400 when any ID in array is invalid", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: [validUUID1, "invalid", validUUID2],
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

    it("should successfully restore a single user", async () => {
      mockBulkRestore.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: [validUUID1],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results.totalSuccess).toBe(1);
      expect(data.results.success).toContain(validUUID1);
      expect(mockBulkRestore).toHaveBeenCalledWith(
        { userIds: [validUUID1] },
        adminId
      );
    });

    it("should successfully restore multiple users", async () => {
      mockBulkRestore.mockResolvedValue({
        success: [validUUID1, validUUID2, validUUID3],
        failed: [],
        totalProcessed: 3,
        totalSuccess: 3,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: [validUUID1, validUUID2, validUUID3],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results.totalSuccess).toBe(3);
      expect(data.results.totalFailed).toBe(0);
      expect(data.message).toContain("3 succeeded");
    });

    it("should handle partial failures", async () => {
      mockBulkRestore.mockResolvedValue({
        success: [validUUID1],
        failed: [
          { userId: validUUID2, reason: "User is not deleted" },
          { userId: validUUID3, reason: "User not found" },
        ],
        totalProcessed: 3,
        totalSuccess: 1,
        totalFailed: 2,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: [validUUID1, validUUID2, validUUID3],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain("1 succeeded");
      expect(data.message).toContain("2 failed");
      expect(data.results.failed).toHaveLength(2);
    });

    it("should handle all failures gracefully", async () => {
      mockBulkRestore.mockResolvedValue({
        success: [],
        failed: [
          { userId: validUUID1, reason: "User not found" },
          { userId: validUUID2, reason: "User is not deleted" },
        ],
        totalProcessed: 2,
        totalSuccess: 0,
        totalFailed: 2,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: [validUUID1, validUUID2],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain("0 succeeded");
      expect(data.message).toContain("2 failed");
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
      mockBulkRestore.mockRejectedValue(new Error("Database connection lost"));

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: [validUUID1],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to perform bulk restore");
      expect(data.details).toBe("Database connection lost");
    });

    it("should handle non-Error objects in catch block", async () => {
      mockBulkRestore.mockRejectedValue("String error");

      const req = createPostRequest("http://localhost:3000/api/users/bulk/restore", {
        userIds: [validUUID1],
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.details).toBe("Unknown error");
    });
  });
});
