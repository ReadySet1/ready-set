import { NextResponse } from "next/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { GET, POST } from "@/app/api/profile/route";

// Mock dependencies
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/utils/prismaDB", () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("Profile API Route", () => {
  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ data: null, error: null })),
      })),
    })),
  };

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
  };

  const mockProfileData = {
    id: "user-123",
    type: "CLIENT",
    email: "test@example.com",
    name: "Test User",
    contactNumber: "123-456-7890",
    companyName: "Test Company",
    status: "pending",
    street1: "123 Test St",
    street2: "",
    city: "Test City",
    state: "TS",
    zip: "12345",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockSupabaseClient);
  });

  describe("GET /api/profile", () => {
    it("should return unauthorized when no user is authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new Request('http://localhost/api/profile');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("should return user profile data for authenticated user", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as any).mockResolvedValue(mockProfileData);

      const request = new Request('http://localhost/api/profile');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(expect.objectContaining(mockProfileData));
      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { id: "user-123" },
        select: expect.objectContaining({
          id: true,
          type: true,
          email: true,
          name: true,
        }),
      });
    });

    it("should return 404 when user profile is not found", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as any).mockResolvedValue(null);

      const request = new Request('http://localhost/api/profile');
      const response = await GET(request);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("User profile not found");
    });

    it("should return 500 for database errors", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      (prisma.profile.findUnique as any).mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = new Request('http://localhost/api/profile');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Database error");
    });
  });

  describe("POST /api/profile", () => {
    const mockProfileInput = {
      auth_user_id: "user-123",
      type: "CLIENT",
      email: "test@example.com",
      name: "Test User",
    };

    const mockUserTableData = {
      id: "user-123",
      type: "CLIENT",
      email: "test@example.com",
    };

    it("should create a new profile for an authenticated user", async () => {
      // Mock user authentication
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock Supabase insert operations
      mockSupabaseClient.from().insert().select.mockResolvedValue({
        data: [mockProfileInput],
        error: null,
      });

      // Mock Prisma transaction
      (prisma.$transaction as any).mockImplementation(async (callback: (prisma: any) => Promise<any>) => {
        return callback({});
      });

      // Mock user metadata update
      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        data: null,
        error: null,
      });

      const mockRequest = new Request('http://localhost/api/profile', {
        method: 'POST',
        body: JSON.stringify({
          profileData: mockProfileInput,
          userTableData: mockUserTableData,
        }),
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('Profile created successfully');
    });

    it("should return 401 when user is not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const mockRequest = new Request('http://localhost/api/profile', {
        method: 'POST',
        body: JSON.stringify({
          profileData: mockProfileInput,
          userTableData: mockUserTableData,
        }),
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("should return 403 when trying to create profile for another user", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { ...mockUser, id: "different-user" } },
        error: null,
      });

      const mockRequest = new Request('http://localhost/api/profile', {
        method: 'POST',
        body: JSON.stringify({
          profileData: { ...mockProfileInput, auth_user_id: "user-123" },
          userTableData: mockUserTableData,
        }),
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized to create profile for another user");
    });

    it("should handle profile creation errors", async () => {
      // Mock user authentication
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock Supabase insert operation failure
      mockSupabaseClient.from().insert().select.mockResolvedValue({
        data: null,
        error: { message: "Profile creation failed" },
      });

      // Mock Prisma transaction
      (prisma.$transaction as any).mockImplementation(async (callback: (prisma: any) => Promise<any>) => {
        throw new Error("Profile creation failed");
      });

      const mockRequest = new Request('http://localhost/api/profile', {
        method: 'POST',
        body: JSON.stringify({
          profileData: mockProfileInput,
          userTableData: mockUserTableData,
        }),
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain("Profile creation failed");
    });
  });
}); 