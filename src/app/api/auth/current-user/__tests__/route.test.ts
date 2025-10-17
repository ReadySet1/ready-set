/**
 * Tests for /api/auth/current-user route
 *
 * This route is CRITICAL as it validates user sessions and profiles
 *
 * Tests cover:
 * - Authentication validation
 * - Profile existence check
 * - Soft-delete protection
 * - Error handling
 */

import { NextRequest } from "next/server";
import { GET } from "../route";
import { createClient } from "@/utils/supabase/server";
import {
  createMockSupabaseAuth,
  createMockUnauthenticated,
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

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe("/api/auth/current-user", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    aud: "authenticated",
    role: "authenticated",
  };

  const mockProfile = {
    type: "CLIENT",
    email: "test@example.com",
    name: "Test User",
    status: "ACTIVE",
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/auth/current-user", () => {
    it("should return 401 when user is not authenticated", async () => {
      // Mock unauthenticated state
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      } as any);

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toBe("Not authenticated");
    });

    it("should return 401 when JWT token is invalid", async () => {
      // Mock JWT error
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "Invalid JWT token" },
          }),
        },
      } as any);

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toContain("Invalid or expired token");
    });

    it("should return 401 when token is expired", async () => {
      // Mock token expiration error (error message without JWT keyword)
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "Auth session missing" },
          }),
        },
      } as any);

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication failed");
    });

    it("should return 404 when user profile does not exist", async () => {
      // Mock authenticated user but no profile
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
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);

      await expectNotFound(response);
    });

    it("should return 403 when user account is soft-deleted", async () => {
      // Mock authenticated user with soft-deleted profile
      const deletedProfile = {
        ...mockProfile,
        deletedAt: new Date("2025-01-01T00:00:00Z"),
      };

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
                data: deletedProfile,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);

      await expectForbidden(response);
    });

    it("should return 500 when profile fetch fails", async () => {
      // Mock database error
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
                data: null,
                error: { message: "Database connection failed" },
              }),
            }),
          }),
        }),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);

      await expectServerError(response);
    });

    it("should return authenticated user with profile when valid", async () => {
      // Mock successful authentication with profile
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
                data: mockProfile,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      // Verify response structure
      expect(data).toHaveProperty("id", mockUser.id);
      expect(data).toHaveProperty("email", mockUser.email);
      expect(data).toHaveProperty("profile");
      expect(data.profile).toMatchObject(mockProfile);
      expect(data).toHaveProperty("sessionInfo");
      expect(data.sessionInfo.validated).toBe(true);
      expect(data.sessionInfo).toHaveProperty("timestamp");
    });

    it("should verify profile has correct fields", async () => {
      // Mock successful authentication
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
                data: mockProfile,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      // Verify profile fields
      expect(data.profile).toHaveProperty("type");
      expect(data.profile).toHaveProperty("email");
      expect(data.profile).toHaveProperty("name");
      expect(data.profile).toHaveProperty("status");
      expect(data.profile).toHaveProperty("deletedAt");
    });

    it("should query profile with correct user ID", async () => {
      const mockFrom = jest.fn();
      const mockSelect = jest.fn();
      const mockEq = jest.fn();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      // Chain the mocks
      mockEq.mockReturnValue({ single: mockSingle });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: mockFrom,
      } as any);

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      await GET(request);

      // Verify query construction
      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(mockSelect).toHaveBeenCalledWith("type, email, name, status, deletedAt");
      expect(mockEq).toHaveBeenCalledWith("id", mockUser.id);
    });

    it("should handle unexpected errors gracefully", async () => {
      // Mock createClient to throw
      mockCreateClient.mockRejectedValue(new Error("Unexpected error"));

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);

      await expectServerError(response);
    });

    it("should include session timestamp in response", async () => {
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
                data: mockProfile,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const beforeTime = new Date().toISOString();
      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);
      const afterTime = new Date().toISOString();

      const data = await expectSuccessResponse(response, 200);

      // Verify timestamp is recent and in ISO format
      expect(data.sessionInfo.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(data.sessionInfo.timestamp >= beforeTime).toBe(true);
      expect(data.sessionInfo.timestamp <= afterTime).toBe(true);
    });

    it("should only query specific profile fields (not sensitive data)", async () => {
      // Mock Supabase to only return the selected fields
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
                data: mockProfile, // Only contains the selected fields
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/auth/current-user");
      const response = await GET(request);

      const data = await expectSuccessResponse(response, 200);

      // Verify only safe fields are returned
      expect(data.profile).toHaveProperty("type");
      expect(data.profile).toHaveProperty("email");
      expect(data.profile).toHaveProperty("name");
      expect(data.profile).toHaveProperty("status");
      expect(data.profile).toHaveProperty("deletedAt");

      // Verify sensitive fields are not in the profile
      expect(data.profile).not.toHaveProperty("passwordHash");
      expect(data.profile).not.toHaveProperty("internalNotes");
    });
  });
});
