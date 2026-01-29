/**
 * API Route Tests for GET /api/users/bulk/ids
 *
 * Tests for bulk user IDs endpoint (select all matching filters)
 */

import { GET } from "../ids/route";
import { UserType, UserStatus } from "@/types/prisma";
import { NextRequest } from "next/server";

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
const mockProfileFindMany = jest.fn();
const mockProfileCount = jest.fn();
jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
      findMany: (...args: unknown[]) => mockProfileFindMany(...args),
      count: (...args: unknown[]) => mockProfileCount(...args),
    },
  },
}));

function createGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

describe("GET /api/users/bulk/ids", () => {
  const adminId = "aaaaaaaa-1234-1234-1234-123456789012";
  const validUUID1 = "12345678-1234-1234-1234-123456789012";
  const validUUID2 = "87654321-4321-4321-4321-210987654321";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = createGetRequest("http://localhost:3000/api/users/bulk/ids");

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

      const req = createGetRequest("http://localhost:3000/api/users/bulk/ids");

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
      mockProfileFindMany.mockResolvedValue([{ id: validUUID1 }]);
      mockProfileCount.mockResolvedValue(1);

      const req = createGetRequest("http://localhost:3000/api/users/bulk/ids");

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
      mockProfileFindMany.mockResolvedValue([{ id: validUUID1 }]);
      mockProfileCount.mockResolvedValue(1);

      const req = createGetRequest("http://localhost:3000/api/users/bulk/ids");

      const response = await GET(req);

      expect(response.status).toBe(200);
    });
  });

  describe("Filtering", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should return all non-SUPER_ADMIN user IDs by default", async () => {
      mockProfileFindMany.mockResolvedValue([
        { id: validUUID1 },
        { id: validUUID2 },
      ]);
      mockProfileCount.mockResolvedValue(2);

      const req = createGetRequest("http://localhost:3000/api/users/bulk/ids");

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ids).toHaveLength(2);
      expect(data.count).toBe(2);
      expect(data.totalCount).toBe(2);
      expect(data.hasMore).toBe(false);
    });

    it("should filter by status", async () => {
      mockProfileFindMany.mockResolvedValue([{ id: validUUID1 }]);
      mockProfileCount.mockResolvedValue(1);

      const req = createGetRequest(
        `http://localhost:3000/api/users/bulk/ids?status=${UserStatus.ACTIVE}`
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockProfileFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: UserStatus.ACTIVE,
          }),
        })
      );
    });

    it("should filter by type", async () => {
      mockProfileFindMany.mockResolvedValue([{ id: validUUID1 }]);
      mockProfileCount.mockResolvedValue(1);

      const req = createGetRequest(
        `http://localhost:3000/api/users/bulk/ids?type=${UserType.VENDOR}`
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockProfileFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: UserType.VENDOR,
          }),
        })
      );
    });

    it("should filter by search term", async () => {
      mockProfileFindMany.mockResolvedValue([{ id: validUUID1 }]);
      mockProfileCount.mockResolvedValue(1);

      const req = createGetRequest(
        "http://localhost:3000/api/users/bulk/ids?search=john"
      );

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockProfileFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ email: { contains: "john", mode: "insensitive" } }),
            ]),
          }),
        })
      );
    });

    it("should include deleted users when includeDeleted=true", async () => {
      mockProfileFindMany.mockResolvedValue([{ id: validUUID1 }]);
      mockProfileCount.mockResolvedValue(1);

      const req = createGetRequest(
        "http://localhost:3000/api/users/bulk/ids?includeDeleted=true"
      );

      const response = await GET(req);

      expect(response.status).toBe(200);
      expect(mockProfileFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: { not: null },
          }),
        })
      );
    });
  });

  describe("Pagination", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: adminId } },
      });
      mockProfileFindUnique.mockResolvedValue({
        type: UserType.ADMIN,
      });
    });

    it("should indicate when there are more results than the limit", async () => {
      // Mock 1000 IDs returned
      const manyIds = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}-${validUUID1.slice(2)}`,
      }));
      mockProfileFindMany.mockResolvedValue(manyIds);
      // But total count is higher
      mockProfileCount.mockResolvedValue(1500);

      const req = createGetRequest("http://localhost:3000/api/users/bulk/ids");

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.count).toBe(1000);
      expect(data.totalCount).toBe(1500);
      expect(data.hasMore).toBe(true);
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

    it("should return 500 when database query fails", async () => {
      mockProfileFindMany.mockRejectedValue(new Error("Database error"));

      const req = createGetRequest("http://localhost:3000/api/users/bulk/ids");

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to fetch user IDs");
    });
  });
});
