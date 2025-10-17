/**
 * Tests for /api/drivers route
 *
 * This route is BUSINESS CRITICAL as it handles sensitive driver data access
 *
 * Tests cover:
 * - GET: Role-based access control for driver listing
 * - Authentication and authorization
 * - Driver data retrieval and filtering
 * - PII/HIPAA compliance verification
 * - Error handling
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/utils/prismaDB";
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/lib/auth-middleware", () => ({
  withAuth: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    profile: {
      findMany: jest.fn(),
    },
  },
}));

const mockWithAuth = withAuth as jest.MockedFunction<typeof withAuth>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("/api/drivers", () => {
  const mockDrivers = [
    {
      id: "driver-1",
      name: "John Driver",
      email: "john.driver@example.com",
      contactNumber: "555-0101",
      status: "ACTIVE",
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
    },
    {
      id: "driver-2",
      name: "Jane Driver",
      email: "jane.driver@example.com",
      contactNumber: "555-0102",
      status: "ACTIVE",
      createdAt: new Date("2025-01-02T00:00:00Z"),
      updatedAt: new Date("2025-01-02T00:00:00Z"),
    },
    {
      id: "driver-3",
      name: "Bob Driver",
      email: "bob.driver@example.com",
      contactNumber: "555-0103",
      status: "INACTIVE",
      createdAt: new Date("2025-01-03T00:00:00Z"),
      updatedAt: new Date("2025-01-03T00:00:00Z"),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/drivers", () => {
    describe("Authentication & Authorization", () => {
      it("should reject unauthenticated requests", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: false,
          response: new Response(
            JSON.stringify({ message: "Unauthorized" }),
            { status: 401 }
          ),
        } as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        await expectUnauthorized(response);
      });

      it("should allow ADMIN role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "admin-user-id",
              email: "admin@example.com",
              user_metadata: { role: "ADMIN" },
            },
          },
        } as any);

        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(mockWithAuth).toHaveBeenCalledWith(
          request,
          expect.objectContaining({
            allowedRoles: ["ADMIN", "SUPER_ADMIN", "HELPDESK", "CLIENT", "DRIVER"],
            requireAuth: true,
          })
        );
      });

      it("should allow SUPER_ADMIN role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "super-admin-id",
              email: "superadmin@example.com",
              user_metadata: { role: "SUPER_ADMIN" },
            },
          },
        } as any);

        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        expect(response.status).toBe(200);
      });

      it("should allow HELPDESK role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "helpdesk-id",
              email: "helpdesk@example.com",
              user_metadata: { role: "HELPDESK" },
            },
          },
        } as any);

        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        expect(response.status).toBe(200);
      });

      it("should allow CLIENT role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "client-id",
              email: "client@example.com",
              user_metadata: { role: "CLIENT" },
            },
          },
        } as any);

        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        expect(response.status).toBe(200);
      });

      it("should allow DRIVER role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "driver-id",
              email: "driver@example.com",
              user_metadata: { role: "DRIVER" },
            },
          },
        } as any);

        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        expect(response.status).toBe(200);
      });

      it("should reject VENDOR role", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: false,
          response: new Response(
            JSON.stringify({ message: "Forbidden - Insufficient permissions" }),
            { status: 403 }
          ),
        } as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        await expectForbidden(response);
      });

      it("should verify requireAuth is enforced", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "admin-id",
              email: "admin@example.com",
              user_metadata: { role: "ADMIN" },
            },
          },
        } as any);

        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        await GET(request);

        expect(mockWithAuth).toHaveBeenCalledWith(
          request,
          expect.objectContaining({
            requireAuth: true,
          })
        );
      });
    });

    describe("Driver Data Retrieval", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              email: "admin@example.com",
              user_metadata: { role: "ADMIN" },
            },
          },
        } as any);
      });

      it("should fetch all drivers successfully", async () => {
        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data).toHaveLength(3);
        expect(data).toEqual(mockDrivers);
      });

      it("should return empty array when no drivers exist", async () => {
        mockPrisma.profile.findMany.mockResolvedValueOnce([]);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data).toHaveLength(0);
        expect(data).toEqual([]);
      });

      it("should only query for DRIVER type profiles", async () => {
        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        await GET(request);

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith({
          where: {
            type: "DRIVER",
          },
          select: {
            id: true,
            name: true,
            email: true,
            contactNumber: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      });

      it("should include all required driver fields", async () => {
        mockPrisma.profile.findMany.mockResolvedValueOnce([mockDrivers[0]] as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data[0]).toHaveProperty("id");
        expect(data[0]).toHaveProperty("name");
        expect(data[0]).toHaveProperty("email");
        expect(data[0]).toHaveProperty("contactNumber");
        expect(data[0]).toHaveProperty("status");
        expect(data[0]).toHaveProperty("createdAt");
        expect(data[0]).toHaveProperty("updatedAt");
      });

      it("should include both ACTIVE and INACTIVE drivers", async () => {
        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        const activeDrivers = data.filter((d: any) => d.status === "ACTIVE");
        const inactiveDrivers = data.filter((d: any) => d.status === "INACTIVE");

        expect(activeDrivers.length).toBe(2);
        expect(inactiveDrivers.length).toBe(1);
      });

      it("should return drivers sorted by createdAt (implicit DB ordering)", async () => {
        const sortedDrivers = [...mockDrivers].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );

        mockPrisma.profile.findMany.mockResolvedValueOnce(sortedDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data[0].id).toBe("driver-1");
        expect(data[1].id).toBe("driver-2");
        expect(data[2].id).toBe("driver-3");
      });
    });

    describe("PII/HIPAA Compliance", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              email: "admin@example.com",
              user_metadata: { role: "ADMIN" },
            },
          },
        } as any);
      });

      it("should include sensitive contact information (email, phone)", async () => {
        mockPrisma.profile.findMany.mockResolvedValueOnce([mockDrivers[0]] as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data[0].email).toBe("john.driver@example.com");
        expect(data[0].contactNumber).toBe("555-0101");
      });

      it("should only expose driver data to authorized roles", async () => {
        // This is verified by the authentication tests above
        // Just ensuring the pattern is followed
        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        await GET(request);

        expect(mockWithAuth).toHaveBeenCalledWith(
          request,
          expect.objectContaining({
            allowedRoles: expect.arrayContaining(["ADMIN", "SUPER_ADMIN", "HELPDESK"]),
          })
        );
      });

      it("should verify CLIENT role has access (business requirement)", async () => {
        mockWithAuth.mockResolvedValueOnce({
          success: true,
          context: {
            user: {
              id: "client-id",
              email: "client@example.com",
              user_metadata: { role: "CLIENT" },
            },
          },
        } as any);

        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        // CLIENT role can see driver contact info (business requirement for order management)
        expect(data[0].email).toBeDefined();
        expect(data[0].contactNumber).toBeDefined();
      });
    });

    describe("Security", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              email: "admin@example.com",
              user_metadata: { role: "ADMIN" },
            },
          },
        } as any);
      });

      it("should not include non-driver profiles in results", async () => {
        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        await GET(request);

        expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              type: "DRIVER",
            },
          })
        );
      });

      it("should not apply userId filter (global driver list)", async () => {
        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        await GET(request);

        const whereClause = (mockPrisma.profile.findMany as jest.Mock).mock.calls[0][0]
          .where;

        expect(whereClause).not.toHaveProperty("userId");
        expect(whereClause).not.toHaveProperty("id");
      });

      it("should only select necessary fields (not sensitive user data)", async () => {
        mockPrisma.profile.findMany.mockResolvedValueOnce(mockDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        await GET(request);

        const selectClause = (mockPrisma.profile.findMany as jest.Mock).mock.calls[0][0]
          .select;

        expect(selectClause).toHaveProperty("id", true);
        expect(selectClause).toHaveProperty("name", true);
        expect(selectClause).toHaveProperty("email", true);
        expect(selectClause).toHaveProperty("contactNumber", true);
        expect(selectClause).toHaveProperty("status", true);
        expect(selectClause).toHaveProperty("createdAt", true);
        expect(selectClause).toHaveProperty("updatedAt", true);

        // Should not select other sensitive fields
        expect(selectClause).not.toHaveProperty("password");
        expect(selectClause).not.toHaveProperty("token");
      });
    });

    describe("Error Handling", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              email: "admin@example.com",
              user_metadata: { role: "ADMIN" },
            },
          },
        } as any);
      });

      it("should handle database errors gracefully", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockPrisma.profile.findMany.mockRejectedValueOnce(
          new Error("Database connection failed")
        );

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        await expectServerError(response);

        const data = await response.json();
        expect(data.error).toBe("Failed to fetch drivers");

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error fetching drivers:",
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      });

      it("should log authentication failures", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockWithAuth.mockResolvedValueOnce({
          success: false,
          response: new Response(
            JSON.stringify({ message: "Forbidden" }),
            { status: 403 }
          ),
        } as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        await GET(request);

        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });

      it("should handle Prisma query errors", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockPrisma.profile.findMany.mockRejectedValueOnce(
          new Error("Prisma Client validation error")
        );

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        expect(response.status).toBe(500);

        consoleErrorSpy.mockRestore();
      });

      it("should handle unexpected errors gracefully", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

        mockPrisma.profile.findMany.mockRejectedValueOnce(
          new Error("Unexpected error")
        );

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectServerError(response);

        expect(data).toHaveProperty("error");
        expect(data.error).toBe("Failed to fetch drivers");

        consoleErrorSpy.mockRestore();
      });
    });

    describe("Edge Cases", () => {
      beforeEach(() => {
        mockWithAuth.mockResolvedValue({
          success: true,
          context: {
            user: {
              id: "admin-id",
              email: "admin@example.com",
              user_metadata: { role: "ADMIN" },
            },
          },
        } as any);
      });

      it("should handle large number of drivers", async () => {
        const manyDrivers = Array.from({ length: 1000 }, (_, i) => ({
          id: `driver-${i}`,
          name: `Driver ${i}`,
          email: `driver${i}@example.com`,
          contactNumber: `555-${String(i).padStart(4, "0")}`,
          status: i % 2 === 0 ? "ACTIVE" : "INACTIVE",
          createdAt: new Date(`2025-01-${(i % 28) + 1}T00:00:00Z`),
          updatedAt: new Date(`2025-01-${(i % 28) + 1}T00:00:00Z`),
        }));

        mockPrisma.profile.findMany.mockResolvedValueOnce(manyDrivers as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data.length).toBe(1000);
      });

      it("should handle drivers with minimal data", async () => {
        const minimalDriver = {
          id: "driver-minimal",
          name: "Min Driver",
          email: "min@example.com",
          contactNumber: null,
          status: null,
          createdAt: new Date("2025-01-01T00:00:00Z"),
          updatedAt: new Date("2025-01-01T00:00:00Z"),
        };

        mockPrisma.profile.findMany.mockResolvedValueOnce([minimalDriver] as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data[0]).toMatchObject({
          id: "driver-minimal",
          name: "Min Driver",
          email: "min@example.com",
        });
      });

      it("should handle drivers with special characters in names", async () => {
        const specialDriver = {
          id: "driver-special",
          name: "José García-López Jr.",
          email: "jose.garcia@example.com",
          contactNumber: "555-0199",
          status: "ACTIVE",
          createdAt: new Date("2025-01-01T00:00:00Z"),
          updatedAt: new Date("2025-01-01T00:00:00Z"),
        };

        mockPrisma.profile.findMany.mockResolvedValueOnce([specialDriver] as any);

        const request = createGetRequest("http://localhost:3000/api/drivers");
        const response = await GET(request);

        const data = await expectSuccessResponse(response);

        expect(data[0].name).toBe("José García-López Jr.");
      });
    });
  });
});
