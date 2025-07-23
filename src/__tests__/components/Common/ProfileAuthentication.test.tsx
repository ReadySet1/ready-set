import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock UserContext with different states
const createMockUserContext = (overrides = {}) => ({
  user: null,
  isLoading: true,
  error: null,
  refreshUserData: vi.fn(),
  userRole: null,
  getDashboardPath: () => "/client",
  getOrderDetailPath: (orderNumber: string) => `/order-status/${orderNumber}`,
  session: null,
  ...overrides,
});

let mockUserContextValue = createMockUserContext();

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => mockUserContextValue,
}));

// Simple ProfileAuth component that mimics the profile page authentication logic
const ProfileAuthComponent = () => {
  const mockUserContext = {
    user: mockUserContextValue.user,
    isLoading: mockUserContextValue.isLoading,
    error: mockUserContextValue.error,
    refreshUserData: mockUserContextValue.refreshUserData,
  };
  const router = { push: mockPush };

  const [profile, setProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchProfile = async () => {
      if (mockUserContext.isLoading) return;

      if (!mockUserContext.user) {
        router.push("/sign-in");
        return;
      }

      try {
        setLoading(true);
        const response = await fetch("/api/profile");

        if (!response.ok) {
          throw new Error("Failed to fetch profile data");
        }

        const userData = await response.json();
        setProfile(userData);
      } catch (err) {
        console.error("Profile fetch error:", err);
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [mockUserContext.user, mockUserContext.isLoading]);

  // Error states (check errors first, even if loading)
  if (mockUserContext.error || error) {
    return (
      <div data-testid="profile-error">
        Error: {mockUserContext.error || error}
      </div>
    );
  }

  // Loading states
  if (mockUserContext.isLoading || loading) {
    return <div data-testid="profile-loading">Loading...</div>;
  }

  // No profile found
  if (!profile) {
    return (
      <div data-testid="profile-not-found">
        <h2>Profile Not Found</h2>
        <button
          onClick={() => router.push("/client")}
          data-testid="fallback-dashboard-button"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div data-testid="profile-success">
      <h1>My Profile</h1>
      <div data-testid="profile-content">
        <p>Name: {profile.name}</p>
        <p>Email: {profile.email}</p>
        <p>Type: {profile.type}</p>
      </div>
    </div>
  );
};

describe("Profile Authentication Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    mockUserContextValue = createMockUserContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should show loading state when user context is loading", () => {
    mockUserContextValue = createMockUserContext({
      isLoading: true,
    });

    render(<ProfileAuthComponent />);

    expect(screen.getByTestId("profile-loading")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should redirect to sign-in when user is not authenticated", async () => {
    mockUserContextValue = createMockUserContext({
      user: null,
      isLoading: false,
    });

    render(<ProfileAuthComponent />);

    // Should attempt to redirect to sign-in
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in");
    });
  });

  it("should display error when user context has error", () => {
    mockUserContextValue = createMockUserContext({
      user: null,
      isLoading: false,
      error: "Authentication failed",
    });

    render(<ProfileAuthComponent />);

    expect(screen.getByTestId("profile-error")).toBeInTheDocument();
    expect(
      screen.getByText("Error: Authentication failed"),
    ).toBeInTheDocument();
  });

  it("should fetch profile data when user is authenticated", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    const mockProfileData = {
      id: "user-123",
      name: "Test User",
      email: "test@example.com",
      type: "CLIENT",
    };

    mockUserContextValue = createMockUserContext({
      user: mockUser,
      isLoading: false,
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfileData,
    });

    render(<ProfileAuthComponent />);

    // Should show loading initially
    expect(screen.getByTestId("profile-loading")).toBeInTheDocument();

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId("profile-success")).toBeInTheDocument();
    });

    // Verify profile data is displayed
    expect(screen.getByText("Name: Test User")).toBeInTheDocument();
    expect(screen.getByText("Email: test@example.com")).toBeInTheDocument();
    expect(screen.getByText("Type: CLIENT")).toBeInTheDocument();

    // Verify API was called
    expect(global.fetch).toHaveBeenCalledWith("/api/profile");
  });

  it("should handle API fetch errors gracefully", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    mockUserContextValue = createMockUserContext({
      user: mockUser,
      isLoading: false,
    });

    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    render(<ProfileAuthComponent />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId("profile-error")).toBeInTheDocument();
    });

    expect(screen.getByText("Error: Network error")).toBeInTheDocument();
  });

  it("should handle profile not found scenario", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    mockUserContextValue = createMockUserContext({
      user: mockUser,
      isLoading: false,
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    });

    render(<ProfileAuthComponent />);

    // Wait for "not found" state
    await waitFor(() => {
      expect(screen.getByTestId("profile-not-found")).toBeInTheDocument();
    });

    expect(screen.getByText("Profile Not Found")).toBeInTheDocument();
    expect(screen.getByTestId("fallback-dashboard-button")).toBeInTheDocument();
  });

  it("should handle 401 unauthorized API responses", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    mockUserContextValue = createMockUserContext({
      user: mockUser,
      isLoading: false,
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(<ProfileAuthComponent />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId("profile-error")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Error: Failed to fetch profile data"),
    ).toBeInTheDocument();
  });

  it("should redirect to client dashboard when fallback button is clicked", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
    };

    mockUserContextValue = createMockUserContext({
      user: mockUser,
      isLoading: false,
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    });

    render(<ProfileAuthComponent />);

    // Wait for "not found" state
    await waitFor(() => {
      expect(screen.getByTestId("profile-not-found")).toBeInTheDocument();
    });

    // Click the fallback button
    const fallbackButton = screen.getByTestId("fallback-dashboard-button");
    fallbackButton.click();

    expect(mockPush).toHaveBeenCalledWith("/client");
  });
});
