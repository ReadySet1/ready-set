/**
 * API Route Tests for GET /api/users/bulk/export
 *
 * Tests for CSV export endpoint with NextRequest/NextResponse patterns
 */

import { GET } from "../export/route";
import { UserType, UserStatus } from "@/types/prisma";
import {
  createGetRequest,
  createRequestWithParams,
} from "@/__tests__/helpers/api-test-helpers";

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
const mockExportUsersToCSV = jest.fn();
jest.mock("@/services/userBulkOperationsService", () => ({
  userBulkOperationsService: {
    exportUsersToCSV: (...args: unknown[]) => mockExportUsersToCSV(...args),
  },
}));

describe("GET /api/users/bulk/export", () => {
  const validUUID1 = "12345678-1234-1234-1234-123456789012";
  const validUUID2 = "87654321-4321-4321-4321-210987654321";
  const adminId = "aaaaaaaa-1234-1234-1234-123456789012";

  const sampleCSV = `ID,Name,Email,Type,Status
${validUUID1},John Doe,john@example.com,CLIENT,ACTIVE
${validUUID2},Jane Smith,jane@example.com,VENDOR,PENDING`;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = createGetRequest("http://localhost:3000/api/users/bulk/export");

      const response = await GET(req);
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

      const req = createGetRequest("http://localhost:3000/api/users/bulk/export");

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Forbidden");
    });

    it("should return 403 when user profile not found", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue(null);

      const req = createGetRequest("http://localhost:3000/api/users/bulk/export");

      const response = await GET(req);
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
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const req = createGetRequest("http://localhost:3000/api/users/bulk/export");

      const response = await GET(req);

      expect(response.status).toBe(200);
    });

    it("should allow SUPER_ADMIN users", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const req = createGetRequest("http://localhost:3000/api/users/bulk/export");

      const response = await GET(req);

      expect(response.status).toBe(200);
    });
  });

  describe("Query Parameter Validation", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should return 400 when userIds contain invalid UUID", async () => {
      const req = createRequestWithParams(
        "http://localhost:3000/api/users/bulk/export",
        { userIds: "invalid-uuid" }
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid user ID format");
    });

    it("should return 400 when status is invalid", async () => {
      const req = createRequestWithParams(
        "http://localhost:3000/api/users/bulk/export",
        { status: "INVALID_STATUS" }
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid status");
    });

    it("should return 400 when type is invalid", async () => {
      const req = createRequestWithParams(
        "http://localhost:3000/api/users/bulk/export",
        { type: "INVALID_TYPE" }
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid type");
    });

    it("should accept valid userIds parameter", async () => {
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const req = createRequestWithParams(
        "http://localhost:3000/api/users/bulk/export",
        { userIds: `${validUUID1},${validUUID2}` }
      );

      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(mockExportUsersToCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: [validUUID1, validUUID2],
        })
      );
    });

    it("should accept valid status parameter", async () => {
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const req = createRequestWithParams(
        "http://localhost:3000/api/users/bulk/export",
        { status: "ACTIVE" }
      );

      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(mockExportUsersToCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          status: UserStatus.ACTIVE,
        })
      );
    });

    it("should accept valid type parameter", async () => {
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const req = createRequestWithParams(
        "http://localhost:3000/api/users/bulk/export",
        { type: "CLIENT" }
      );

      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(mockExportUsersToCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          type: UserType.CLIENT,
        })
      );
    });

    it("should accept includeDeleted parameter", async () => {
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const req = createRequestWithParams(
        "http://localhost:3000/api/users/bulk/export",
        { includeDeleted: "true" }
      );

      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(mockExportUsersToCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          includeDeleted: true,
        })
      );
    });

    it("should default includeDeleted to false", async () => {
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const req = createGetRequest("http://localhost:3000/api/users/bulk/export");

      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(mockExportUsersToCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          includeDeleted: false,
        })
      );
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

    it("should return CSV content with correct headers", async () => {
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const req = createGetRequest("http://localhost:3000/api/users/bulk/export");

      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/csv");
      expect(response.headers.get("Content-Disposition")).toContain("attachment");
      expect(response.headers.get("Content-Disposition")).toContain(
        "users-export-"
      );
      expect(response.headers.get("Content-Disposition")).toContain(".csv");
    });

    it("should return CSV content in response body", async () => {
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const req = createGetRequest("http://localhost:3000/api/users/bulk/export");

      const response = await GET(req);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain("ID,Name,Email");
      expect(body).toContain("john@example.com");
    });

    it("should combine multiple query parameters", async () => {
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const url = new URL("http://localhost:3000/api/users/bulk/export");
      url.searchParams.set("status", "ACTIVE");
      url.searchParams.set("type", "CLIENT");
      url.searchParams.set("includeDeleted", "true");
      const req = createGetRequest(url.toString());

      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(mockExportUsersToCSV).toHaveBeenCalledWith({
        status: UserStatus.ACTIVE,
        type: UserType.CLIENT,
        includeDeleted: true,
      });
    });

    it("should filter empty userIds from comma-separated list", async () => {
      mockExportUsersToCSV.mockResolvedValue(sampleCSV);

      const req = createRequestWithParams(
        "http://localhost:3000/api/users/bulk/export",
        { userIds: `${validUUID1},,${validUUID2},` }
      );

      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(mockExportUsersToCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: [validUUID1, validUUID2],
        })
      );
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
      mockExportUsersToCSV.mockRejectedValue(new Error("Database query failed"));

      const req = createGetRequest("http://localhost:3000/api/users/bulk/export");

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to export users");
      expect(data.details).toBe("Database query failed");
    });

    it("should handle non-Error objects in catch block", async () => {
      mockExportUsersToCSV.mockRejectedValue({ custom: "error" });

      const req = createGetRequest("http://localhost:3000/api/users/bulk/export");

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.details).toBe("Unknown error");
    });
  });
});
