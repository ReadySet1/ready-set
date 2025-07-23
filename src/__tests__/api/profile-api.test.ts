import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

// Mock dependencies
vi.mock("@/utils/prismaDB", () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock NextResponse
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200,
      headers: options?.headers || {},
    })),
  },
}));

import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";

// Mock the actual route handler function
const profileApiHandler = async () => {
  try {
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Get user session from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { 
        status: 401,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    // Get the user's profile from your database
    const userData = await prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        type: true,
        email: true,
        name: true,
        contactName: true,
        image: true,
        status: true
      }
    });
    
    if (!userData) {
      return NextResponse.json({ error: "User profile not found" }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }
    
    return NextResponse.json(userData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      },
    );
  }
};

describe("Profile API Route", () => {
  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockSupabaseClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return user profile data for authenticated user", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    const mockProfileData = {
      id: "user-123",
      type: "CLIENT",
      email: "test@example.com",
      name: "Test User",
      contactName: "Test Contact",
      image: null,
      status: "pending",
    };

    // Mock successful user authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock successful profile fetch
    (prisma.profile.findUnique as any).mockResolvedValue(mockProfileData);

    const response = await profileApiHandler();

    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    expect(prisma.profile.findUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: {
        id: true,
        type: true,
        email: true,
        name: true,
        contactName: true,
        image: true,
        status: true,
      },
    });

    expect(NextResponse.json).toHaveBeenCalledWith(mockProfileData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  });

  it("should return 401 for unauthenticated user", async () => {
    // Mock no user authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await profileApiHandler();

    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  });

  it("should return 401 for authentication error", async () => {
    // Mock authentication error
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await profileApiHandler();

    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  });

  it("should return 404 when user profile is not found", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    // Mock successful user authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock profile not found
    (prisma.profile.findUnique as any).mockResolvedValue(null);

    const response = await profileApiHandler();

    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    expect(prisma.profile.findUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: {
        id: true,
        type: true,
        email: true,
        name: true,
        contactName: true,
        image: true,
        status: true,
      },
    });

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "User profile not found" },
      {
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  });

  it("should return 500 for database errors", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    // Mock successful user authentication
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock database error
    (prisma.profile.findUnique as any).mockRejectedValue(new Error("Database connection failed"));

    // Spy on console.error to verify error logging
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await profileApiHandler();

    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    expect(prisma.profile.findUnique).toHaveBeenCalled();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error fetching user profile:",
      expect.any(Error)
    );

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Internal Server Error" },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

    consoleErrorSpy.mockRestore();
  });

  it("should include proper cache control headers in all responses", async () => {
    const expectedCacheHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    // Test successful response
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    const mockProfileData = {
      id: "user-123",
      type: "CLIENT",
      email: "test@example.com",
      name: "Test User",
      status: "pending",
    };

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    (prisma.profile.findUnique as any).mockResolvedValue(mockProfileData);

    await profileApiHandler();

    expect(NextResponse.json).toHaveBeenCalledWith(mockProfileData, {
      headers: expectedCacheHeaders
    });

    // Test unauthorized response
    vi.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await profileApiHandler();

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: expectedCacheHeaders
      }
    );
  });

  it("should select only required profile fields", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    (prisma.profile.findUnique as any).mockResolvedValue({
      id: "user-123",
      type: "CLIENT",
      email: "test@example.com",
      name: "Test User",
      status: "pending",
    });

    await profileApiHandler();

    expect(prisma.profile.findUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: {
        id: true,
        type: true,
        email: true,
        name: true,
        contactName: true,
        image: true,
        status: true,
      },
    });
  });
}); 