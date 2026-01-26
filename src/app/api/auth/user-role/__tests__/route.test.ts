/**
 * Tests for /api/auth/user-role route
 *
 * This route checks user role/permissions for admin access control.
 *
 * Tests cover:
 * - Authentication validation (Bearer token required)
 * - Profile existence check
 * - Soft-delete protection
 * - Role detection (ADMIN, SUPER_ADMIN, HELPDESK)
 * - Error handling
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/db/prisma";
import {
  expectSuccessResponse,
  expectUnauthorized,
  expectNotFound,
  expectForbidden,
  expectServerError,
} from "@/__tests__/helpers/api-test-helpers";

// Mock dependencies
jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
  },
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPrisma = prisma as any;

// Helper to create request with Bearer token
function createRequestWithAuth(token: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/user-role", {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

// Helper to create request without auth header
function createRequestWithoutAuth(): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/user-role");
}

describe("/api/auth/user-role", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/auth/user-role", () => {
    describe("Authentication", () => {
      it("should return 401 when no authorization header is provided", async () => {
        const request = createRequestWithoutAuth();
        const response = await GET(request);

        const data = await response.json();
        expect(response.status).toBe(401);
        expect(data.isAdmin).toBe(false);
        expect(data.isSuperAdmin).toBe(false);
        expect(data.error).toContain("Invalid authorization header");
      });

      it("should return 401 when authorization header is malformed", async () => {
        const request = new NextRequest("http://localhost:3000/api/auth/user-role", {
          headers: {
            authorization: "InvalidFormat token123",
          },
        });

        const response = await GET(request);

        const data = await response.json();
        expect(response.status).toBe(401);
        expect(data.isAdmin).toBe(false);
        expect(data.isSuperAdmin).toBe(false);
      });

      it("should return 401 when JWT token is invalid", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: null },
              error: { message: "Invalid JWT token" },
            }),
          },
        } as any);

        const request = createRequestWithAuth("invalid-token");
        const response = await GET(request);

        const data = await response.json();
        expect(response.status).toBe(401);
        expect(data.isAdmin).toBe(false);
        expect(data.isSuperAdmin).toBe(false);
        expect(data.error).toContain("Invalid JWT token");
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

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        const data = await response.json();
        expect(response.status).toBe(401);
        expect(data.isAdmin).toBe(false);
        expect(data.isSuperAdmin).toBe(false);
      });
    });

    describe("Profile validation", () => {
      it("should return 404 when user profile does not exist", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
        } as any);

        mockPrisma.profile.findUnique.mockResolvedValue(null);

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        const data = await response.json();
        expect(response.status).toBe(404);
        expect(data.isAdmin).toBe(false);
        expect(data.isSuperAdmin).toBe(false);
        expect(data.error).toContain("not found");
      });

      it("should return 403 when user account is soft-deleted", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
        } as any);

        mockPrisma.profile.findUnique.mockResolvedValue({
          type: "ADMIN",
          deletedAt: new Date("2025-01-01T00:00:00Z"),
        });

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        const data = await response.json();
        expect(response.status).toBe(403);
        expect(data.isAdmin).toBe(false);
        expect(data.isSuperAdmin).toBe(false);
        expect(data.error).toContain("deactivated");
      });
    });

    describe("Role detection", () => {
      it("should correctly identify ADMIN role", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
        } as any);

        mockPrisma.profile.findUnique.mockResolvedValue({
          type: "ADMIN",
          deletedAt: null,
        });

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);
        expect(data.isAdmin).toBe(true);
        expect(data.isSuperAdmin).toBe(false);
        expect(data.isHelpdesk).toBe(false);
        expect(data.userType).toBe("ADMIN");
      });

      it("should correctly identify SUPER_ADMIN role", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
        } as any);

        mockPrisma.profile.findUnique.mockResolvedValue({
          type: "SUPER_ADMIN",
          deletedAt: null,
        });

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);
        expect(data.isAdmin).toBe(false);
        expect(data.isSuperAdmin).toBe(true);
        expect(data.isHelpdesk).toBe(false);
        expect(data.userType).toBe("SUPER_ADMIN");
      });

      it("should correctly identify HELPDESK role", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
        } as any);

        mockPrisma.profile.findUnique.mockResolvedValue({
          type: "HELPDESK",
          deletedAt: null,
        });

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);
        expect(data.isAdmin).toBe(false);
        expect(data.isSuperAdmin).toBe(false);
        expect(data.isHelpdesk).toBe(true);
        expect(data.userType).toBe("HELPDESK");
      });

      it("should return false for all admin flags for CLIENT role", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
        } as any);

        mockPrisma.profile.findUnique.mockResolvedValue({
          type: "CLIENT",
          deletedAt: null,
        });

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);
        expect(data.isAdmin).toBe(false);
        expect(data.isSuperAdmin).toBe(false);
        expect(data.isHelpdesk).toBe(false);
        expect(data.userType).toBe("CLIENT");
      });

      it("should return false for all admin flags for DRIVER role", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
        } as any);

        mockPrisma.profile.findUnique.mockResolvedValue({
          type: "DRIVER",
          deletedAt: null,
        });

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);
        expect(data.isAdmin).toBe(false);
        expect(data.isSuperAdmin).toBe(false);
        expect(data.isHelpdesk).toBe(false);
        expect(data.userType).toBe("DRIVER");
      });

      it("should handle case-insensitive role comparison", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
        } as any);

        // Test lowercase admin
        mockPrisma.profile.findUnique.mockResolvedValue({
          type: "admin",
          deletedAt: null,
        });

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        const data = await expectSuccessResponse(response, 200);
        expect(data.isAdmin).toBe(true);
      });
    });

    describe("Error handling", () => {
      it("should return 500 when database query fails", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
        } as any);

        mockPrisma.profile.findUnique.mockRejectedValue(
          new Error("Database connection failed")
        );

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        await expectServerError(response);
      });

      it("should return 500 when createClient throws", async () => {
        mockCreateClient.mockRejectedValue(new Error("Supabase initialization failed"));

        const request = createRequestWithAuth("valid-token");
        const response = await GET(request);

        await expectServerError(response);
      });
    });

    describe("Query construction", () => {
      it("should query profile with correct user ID and select fields", async () => {
        mockCreateClient.mockResolvedValue({
          auth: {
            getUser: jest.fn().mockResolvedValue({
              data: { user: mockUser },
              error: null,
            }),
          },
        } as any);

        mockPrisma.profile.findUnique.mockResolvedValue({
          type: "CLIENT",
          deletedAt: null,
        });

        const request = createRequestWithAuth("valid-token");
        await GET(request);

        expect(mockPrisma.profile.findUnique).toHaveBeenCalledWith({
          where: { id: mockUser.id },
          select: { type: true, deletedAt: true },
        });
      });
    });
  });
});
