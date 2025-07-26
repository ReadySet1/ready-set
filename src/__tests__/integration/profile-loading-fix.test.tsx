import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import ProfilePage from "@/app/(site)/profile/page";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock UserContext
vi.mock("@/contexts/UserContext", () => ({
  useUser: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe("Profile Page Loading Fix", () => {
  const mockPush = vi.fn();
  const mockRouter = { push: mockPush };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  it("should allow authenticated users to access profile page", async () => {
    // Mock authenticated user
    const mockUser = {
      id: "test-user-id",
      email: "test@example.com",
    };

    const mockAuthState = {
      isInitialized: true,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      retryCount: 0,
      lastAuthCheck: new Date(),
    };

    (useUser as any).mockReturnValue({
      user: mockUser,
      userRole: "client",
      isLoading: false,
      error: null,
      session: { user: mockUser },
      authState: mockAuthState,
      profileState: {
        data: null,
        isLoading: false,
        error: null,
        lastFetched: null,
        retryCount: 0,
      },
      refreshUserData: vi.fn(),
      retryAuth: vi.fn(),
      clearError: vi.fn(),
    });

    // Mock successful profile API response
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
        type: "client",
      }),
    });

    render(<ProfilePage />);

    // Should not redirect to sign-in
    await waitFor(() => {
      expect(mockPush).not.toHaveBeenCalledWith("/sign-in");
    });

    // Should show profile content (loading skeleton initially)
    expect(screen.getByTestId("profile-skeleton")).toBeInTheDocument();
  });

  it("should redirect unauthenticated users to sign-in", async () => {
    // Mock unauthenticated user
    const mockAuthState = {
      isInitialized: true,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      retryCount: 0,
      lastAuthCheck: new Date(),
    };

    (useUser as any).mockReturnValue({
      user: null,
      userRole: null,
      isLoading: false,
      error: null,
      session: null,
      authState: mockAuthState,
      profileState: {
        data: null,
        isLoading: false,
        error: null,
        lastFetched: null,
        retryCount: 0,
      },
      refreshUserData: vi.fn(),
      retryAuth: vi.fn(),
      clearError: vi.fn(),
    });

    render(<ProfilePage />);

    // Should redirect to sign-in after timeout
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/sign-in");
      },
      { timeout: 2000 },
    );
  });

  it("should handle user with authState.isAuthenticated but no user object", async () => {
    // Mock edge case where authState says authenticated but no user object
    const mockAuthState = {
      isInitialized: true,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      retryCount: 0,
      lastAuthCheck: new Date(),
    };

    (useUser as any).mockReturnValue({
      user: null, // No user object
      userRole: null,
      isLoading: false,
      error: null,
      session: null,
      authState: mockAuthState,
      profileState: {
        data: null,
        isLoading: false,
        error: null,
        lastFetched: null,
        retryCount: 0,
      },
      refreshUserData: vi.fn(),
      retryAuth: vi.fn(),
      clearError: vi.fn(),
    });

    render(<ProfilePage />);

    // Should wait and not immediately redirect
    await waitFor(
      () => {
        expect(mockPush).not.toHaveBeenCalledWith("/sign-in");
      },
      { timeout: 1000 },
    );
  });
});
