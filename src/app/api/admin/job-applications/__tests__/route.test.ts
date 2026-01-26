/**
 * Tests for /api/admin/job-applications route
 *
 * This is an ADMIN route that manages job applications.
 *
 * Tests cover:
 * - Authentication validation (Bearer token required)
 * - Role-based access control (ADMIN, HELPDESK, SUPER_ADMIN only)
 * - Pagination support
 * - Filtering by status, position, and search
 * - Stats-only mode
 * - Soft-delete filtering
 * - Error handling
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { createClient } from "@/utils/supabase/server";
import { prisma, withDatabaseRetry } from "@/utils/prismaDB";
import { ApplicationStatus } from "@/types/job-application";
import {
  createRequestWithParams,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    jobApplication: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
  withDatabaseRetry: jest.fn((fn) => fn()),
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as any;

// Helper to create request with Bearer token
function createAdminRequest(
  params: Record<string, string> = {},
  token: string = "valid-token"
): NextRequest {
  const url = new URL("http://localhost:3000/api/admin/job-applications");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const request = new NextRequest(url.toString(), {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  // Ensure nextUrl is properly set
  Object.defineProperty(request, "nextUrl", {
    value: url,
    writable: false,
    configurable: true,
  });

  return request;
}

describe("/api/admin/job-applications", () => {
  const mockUser = {
    id: "admin-user-id",
    email: "admin@example.com",
  };

  const mockJobApplication = {
    id: "app-1",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "555-0100",
    position: "Driver",
    status: ApplicationStatus.PENDING,
    createdAt: new Date("2025-01-15T10:00:00Z"),
    deletedAt: null,
    fileUploads: [],
  };

  const mockApplications = [
    mockJobApplication,
    {
      ...mockJobApplication,
      id: "app-2",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@example.com",
      status: ApplicationStatus.APPROVED,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated admin user
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: "ADMIN" },
              error: null,
            }),
          }),
        }),
      }),
    } as any);

    // Default: mock prisma responses
    mockPrisma.jobApplication.count.mockResolvedValue(2);
    mockPrisma.jobApplication.findMany.mockResolvedValue(mockApplications);
    mockPrisma.jobApplication.groupBy.mockResolvedValue([
      { position: "Driver", _count: { position: 5 } },
      { position: "Admin", _count: { position: 3 } },
    ]);
  });

  describe("GET /api/admin/job-applications", () => {
    describe("Authentication", () => {
      it("should return 401 when no authorization header is provided", async () => {
        const request = new NextRequest("http://localhost:3000/api/admin/job-applications");

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it("should return 401 when authorization header is malformed", async () => {
        const request = new NextRequest("http://localhost:3000/api/admin/job-applications", {
          headers: {
            authorization: "InvalidFormat token",
          },
        });

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it("should return 401 when JWT token is invalid", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: { message: "Invalid token" },
            }),
          },
        } as any);

        const request = createAdminRequest({}, "invalid-token");
        const response = await GET(request);

        await expectUnauthorized(response);
      });

      it("should return 401 when user is not found", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
        } as any);

        const request = createAdminRequest();
        const response = await GET(request);

        await expectUnauthorized(response);
      });
    });

    describe("Role-based access control", () => {
      it("should return 403 for CLIENT role", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { type: "CLIENT" },
                  error: null,
                }),
              }),
            }),
          }),
        } as any);

        const request = createAdminRequest();
        const response = await GET(request);

        await expectForbidden(response);
      });

      it("should return 403 for DRIVER role", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { type: "DRIVER" },
                  error: null,
                }),
              }),
            }),
          }),
        } as any);

        const request = createAdminRequest();
        const response = await GET(request);

        await expectForbidden(response);
      });

      it("should allow access for ADMIN role", async () => {
        const request = createAdminRequest();
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);
        expect(data.applications).toBeDefined();
      });

      it("should allow access for HELPDESK role", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { type: "HELPDESK" },
                  error: null,
                }),
              }),
            }),
          }),
        } as any);

        const request = createAdminRequest();
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);
        expect(data.applications).toBeDefined();
      });

      it("should allow access for SUPER_ADMIN role", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { type: "SUPER_ADMIN" },
                  error: null,
                }),
              }),
            }),
          }),
        } as any);

        const request = createAdminRequest();
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);
        expect(data.applications).toBeDefined();
      });
    });

    describe("Pagination", () => {
      it("should use default pagination (page 1, limit 10)", async () => {
        const request = createAdminRequest();
        await GET(request);

        expect(mockPrisma.jobApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 0,
            take: 10,
          })
        );
      });

      it("should respect custom page parameter", async () => {
        const request = createAdminRequest({ page: "2", limit: "10" });
        await GET(request);

        expect(mockPrisma.jobApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 10,
            take: 10,
          })
        );
      });

      it("should respect custom limit parameter", async () => {
        const request = createAdminRequest({ limit: "25" });
        await GET(request);

        expect(mockPrisma.jobApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 25,
          })
        );
      });

      it("should return pagination metadata", async () => {
        mockPrisma.jobApplication.count.mockResolvedValue(25);

        const request = createAdminRequest({ page: "1", limit: "10" });
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.totalCount).toBe(25);
        expect(data.totalPages).toBe(3);
        expect(data.currentPage).toBe(1);
      });
    });

    describe("Filtering", () => {
      it("should filter by status", async () => {
        const request = createAdminRequest({ status: "PENDING" });
        await GET(request);

        expect(mockPrisma.jobApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: "PENDING",
            }),
          })
        );
      });

      it("should filter by position", async () => {
        const request = createAdminRequest({ position: "Driver" });
        await GET(request);

        expect(mockPrisma.jobApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              position: "Driver",
            }),
          })
        );
      });

      it("should search across firstName, lastName, and email", async () => {
        const request = createAdminRequest({ search: "john" });
        await GET(request);

        expect(mockPrisma.jobApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  firstName: expect.objectContaining({ contains: "john" }),
                }),
                expect.objectContaining({
                  lastName: expect.objectContaining({ contains: "john" }),
                }),
                expect.objectContaining({
                  email: expect.objectContaining({ contains: "john" }),
                }),
              ]),
            }),
          })
        );
      });

      it("should always filter out soft-deleted records", async () => {
        const request = createAdminRequest();
        await GET(request);

        expect(mockPrisma.jobApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              deletedAt: null,
            }),
          })
        );
      });

      it("should combine multiple filters", async () => {
        const request = createAdminRequest({
          status: "PENDING",
          position: "Driver",
          search: "john",
        });
        await GET(request);

        expect(mockPrisma.jobApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: "PENDING",
              position: "Driver",
              deletedAt: null,
            }),
          })
        );
      });
    });

    describe("Stats only mode", () => {
      beforeEach(() => {
        mockPrisma.jobApplication.count
          .mockResolvedValueOnce(10) // total
          .mockResolvedValueOnce(5) // pending
          .mockResolvedValueOnce(3) // approved
          .mockResolvedValueOnce(1) // rejected
          .mockResolvedValueOnce(1); // interviewing
      });

      it("should return stats when statsOnly=true", async () => {
        const request = createAdminRequest({ statsOnly: "true" });
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.totalApplications).toBeDefined();
        expect(data.pendingApplications).toBeDefined();
        expect(data.approvedApplications).toBeDefined();
        expect(data.rejectedApplications).toBeDefined();
        expect(data.interviewingApplications).toBeDefined();
        expect(data.applicationsByPosition).toBeDefined();
      });

      it("should not return applications list when statsOnly=true", async () => {
        const request = createAdminRequest({ statsOnly: "true" });
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.applications).toBeUndefined();
      });

      it("should return recent applications in stats", async () => {
        mockPrisma.jobApplication.findMany.mockResolvedValueOnce([mockJobApplication]);

        const request = createAdminRequest({ statsOnly: "true" });
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.recentApplications).toBeDefined();
      });
    });

    describe("Response structure", () => {
      it("should include applications array", async () => {
        const request = createAdminRequest();
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.applications).toBeInstanceOf(Array);
        expect(data.applications).toHaveLength(2);
      });

      it("should include file upload metadata", async () => {
        const applicationWithFiles = {
          ...mockJobApplication,
          fileUploads: [
            {
              id: "file-1",
              fileName: "resume.pdf",
              fileType: "application/pdf",
              fileSize: 1024,
              fileUrl: "https://example.com/storage/files/resume.pdf",
              uploadedAt: new Date(),
              category: "resume",
            },
          ],
        };
        mockPrisma.jobApplication.findMany.mockResolvedValue([applicationWithFiles]);

        const request = createAdminRequest();
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);

        expect(data.applications[0].hasFileUploads).toBe(true);
        expect(data.applications[0].fileUploadCount).toBe(1);
      });

      it("should order by createdAt descending", async () => {
        const request = createAdminRequest();
        await GET(request);

        expect(mockPrisma.jobApplication.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { createdAt: "desc" },
          })
        );
      });
    });

    describe("Error handling", () => {
      it("should return 500 when database query fails", async () => {
        mockPrisma.jobApplication.findMany.mockRejectedValue(
          new Error("Database connection failed")
        );

        const request = createAdminRequest();
        const response = await GET(request);

        await expectServerError(response);
      });

      it("should return 500 when createClient throws", async () => {
        mockCreateClient.mockRejectedValue(new Error("Supabase initialization failed"));

        const request = createAdminRequest();
        const response = await GET(request);

        await expectServerError(response);
      });
    });
  });
});
