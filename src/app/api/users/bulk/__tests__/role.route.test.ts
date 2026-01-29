/**
 * API Route Tests for POST /api/users/bulk/role
 *
 * Tests for bulk role change endpoint
 */

import { POST } from "../role/route";
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
const mockBulkRoleChange = jest.fn();
jest.mock("@/services/userBulkOperationsService", () => ({
  userBulkOperationsService: {
    bulkRoleChange: (...args: unknown[]) => mockBulkRoleChange(...args),
  },
}));

describe("POST /api/users/bulk/role", () => {
  const validUUID1 = "12345678-1234-1234-1234-123456789012";
  const validUUID2 = "87654321-4321-4321-4321-210987654321";
  const superAdminId = "aaaaaaaa-1234-1234-1234-123456789012";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: [validUUID1],
        newRole: UserType.VENDOR,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });
  });

  describe("Authorization", () => {
    it("should return 403 when user is not SUPER_ADMIN", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: superAdminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN, // Only ADMIN, not SUPER_ADMIN
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: [validUUID1],
        newRole: UserType.VENDOR,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Super Admin permissions required");
    });

    it("should allow SUPER_ADMIN users", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: superAdminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });
      mockBulkRoleChange.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: [validUUID1],
        newRole: UserType.VENDOR,
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });

  describe("Request Validation", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: superAdminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });
    });

    it("should return 400 when userIds is not an array", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: "not-an-array",
        newRole: UserType.VENDOR,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("userIds must be a non-empty array");
    });

    it("should return 400 when userIds is empty", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: [],
        newRole: UserType.VENDOR,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("userIds must be a non-empty array");
    });

    it("should return 400 when newRole is invalid", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: [validUUID1],
        newRole: "INVALID_ROLE",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid role");
    });

    it("should return 400 when trying to assign SUPER_ADMIN role", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: [validUUID1],
        newRole: UserType.SUPER_ADMIN,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Cannot assign SUPER_ADMIN role");
    });

    it("should return 400 when user ID format is invalid", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: ["invalid-uuid"],
        newRole: UserType.VENDOR,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid user ID format");
    });

    it("should return 400 when trying to change own role", async () => {
      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: [superAdminId], // Same as the current user
        newRole: UserType.ADMIN,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Cannot change your own role");
    });
  });

  describe("Successful Operations", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: superAdminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });
    });

    it("should successfully change role for multiple users", async () => {
      mockBulkRoleChange.mockResolvedValue({
        success: [validUUID1, validUUID2],
        failed: [],
        totalProcessed: 2,
        totalSuccess: 2,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: [validUUID1, validUUID2],
        newRole: UserType.VENDOR,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.results.totalSuccess).toBe(2);
      expect(data.results.totalFailed).toBe(0);
      expect(mockBulkRoleChange).toHaveBeenCalledWith(
        {
          userIds: [validUUID1, validUUID2],
          newRole: UserType.VENDOR,
          reason: undefined,
        },
        superAdminId
      );
    });

    it("should include reason when provided", async () => {
      mockBulkRoleChange.mockResolvedValue({
        success: [validUUID1],
        failed: [],
        totalProcessed: 1,
        totalSuccess: 1,
        totalFailed: 0,
      });

      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: [validUUID1],
        newRole: UserType.DRIVER,
        reason: "Promoted to driver",
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(mockBulkRoleChange).toHaveBeenCalledWith(
        {
          userIds: [validUUID1],
          newRole: UserType.DRIVER,
          reason: "Promoted to driver",
        },
        superAdminId
      );
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: superAdminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });
    });

    it("should return 500 when service throws an error", async () => {
      mockBulkRoleChange.mockRejectedValue(new Error("Database connection failed"));

      const req = createPostRequest("http://localhost:3000/api/users/bulk/role", {
        userIds: [validUUID1],
        newRole: UserType.VENDOR,
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to perform bulk role change");
      expect(data.details).toBe("Database connection failed");
    });
  });
});
