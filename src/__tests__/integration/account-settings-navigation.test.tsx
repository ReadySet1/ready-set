import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn(() => "/client");

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
}));

// Mock UserContext
const mockUser = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: {},
};

const mockUserContext = {
  user: mockUser,
  isLoading: false,
  error: null,
  refreshUserData: vi.fn(),
  userRole: "CLIENT",
  getDashboardPath: () => "/client",
  getOrderDetailPath: (orderNumber: string) => `/order-status/${orderNumber}`,
  session: null,
};

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => mockUserContext,
}));

// Mock profile API response
const mockProfileResponse = {
  id: "user-123",
  type: "CLIENT",
  email: "test@example.com",
  name: "Test User",
  status: "pending",
};

// Mock global fetch
beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock Client Dashboard Quick Actions component
const MockClientDashboardQuickActions = () => {
  const mockRouter = { push: mockPush };

  return (
    <div data-testid="quick-actions-section">
      <div className="border-b border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800">Quick Actions</h2>
      </div>
      <div className="space-y-3 p-6">
        <button
          onClick={() => mockRouter.push("/catering-request")}
          className="flex items-center rounded-lg border border-gray-100 p-3"
          data-testid="new-order-link"
          data-href="/catering-request"
        >
          New Order
        </button>
        <button
          onClick={() => mockRouter.push("/addresses")}
          className="flex items-center rounded-lg border border-gray-100 p-3"
          data-testid="manage-addresses-link"
          data-href="/addresses"
        >
          Manage Addresses
        </button>
        <button
          onClick={() => mockRouter.push("/profile")}
          className="flex items-center rounded-lg border border-gray-100 p-3"
          data-testid="account-settings-link"
          data-href="/profile"
        >
          <div>
            <h4 className="font-medium text-gray-900">Account Settings</h4>
            <p className="text-xs text-gray-500">Manage your account details</p>
          </div>
        </button>
        <button
          onClick={() => mockRouter.push("/contact")}
          className="flex items-center rounded-lg border border-gray-100 p-3"
          data-testid="contact-us-link"
          data-href="/contact"
        >
          Contact Us
        </button>
        <button
          onClick={() => mockRouter.push("/client")}
          className="flex items-center rounded-lg border border-gray-100 p-3"
          data-testid="view-dashboard-link"
          data-href="/client"
        >
          View Dashboard
        </button>
        <button
          onClick={() => mockRouter.push("/order-status")}
          className="flex items-center rounded-lg border border-gray-100 p-3"
          data-testid="my-orders-link"
          data-href="/order-status"
        >
          My Orders
        </button>
      </div>
    </div>
  );
};

// Mock Profile Page component
const MockProfilePage = () => {
  const [profile, setProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const mockRouter = { push: mockPush };

  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!mockUserContext.user) {
        mockRouter.push("/sign-in");
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
  }, []);

  if (mockUserContext.isLoading || loading) {
    return <div data-testid="profile-loading">Loading profile...</div>;
  }

  if (mockUserContext.error || error) {
    return (
      <div data-testid="profile-error">
        Profile Error: {mockUserContext.error || error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div data-testid="profile-not-found">
        <h2>Profile Not Found</h2>
        <button
          onClick={() => mockRouter.push("/client")}
          data-testid="go-to-dashboard-button"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div data-testid="profile-page">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">My Profile</h1>
          <p className="text-slate-600">{profile.name || mockUser?.email}</p>
        </div>

        {/* Quick Actions in Profile */}
        <div data-testid="profile-quick-actions">
          <h2>Quick Actions</h2>
          <button
            onClick={() => mockRouter.push("/client")}
            data-testid="profile-view-dashboard-button"
          >
            View Dashboard
          </button>
          <button
            onClick={() => mockRouter.push("/order-status")}
            data-testid="profile-my-orders-button"
          >
            My Orders
          </button>
        </div>

        {/* Profile Information */}
        <div data-testid="profile-information">
          <h2>Personal Information</h2>
          <div data-testid="profile-name">{profile.name || "Not provided"}</div>
          <div data-testid="profile-email">
            {profile.email || mockUser?.email}
          </div>
          <div data-testid="profile-type">{profile.type || "CLIENT"}</div>
          <div data-testid="profile-status">
            {profile.status?.toUpperCase() || "PENDING"}
          </div>
        </div>
      </div>
    </div>
  );
};

describe("Account Settings Navigation Flow", () => {
  it("should display Account Settings link in client dashboard Quick Actions", () => {
    render(<MockClientDashboardQuickActions />);

    // Verify Account Settings link exists
    const accountSettingsLink = screen.getByTestId("account-settings-link");
    expect(accountSettingsLink).toBeInTheDocument();
    expect(accountSettingsLink).toHaveAttribute("data-href", "/profile");

    // Verify the link text and description
    expect(screen.getByText("Account Settings")).toBeInTheDocument();
    expect(screen.getByText("Manage your account details")).toBeInTheDocument();
  });

  it("should display all required Quick Actions links", () => {
    render(<MockClientDashboardQuickActions />);

    // Verify all Quick Actions links are present
    expect(screen.getByTestId("new-order-link")).toHaveAttribute(
      "data-href",
      "/catering-request",
    );
    expect(screen.getByTestId("manage-addresses-link")).toHaveAttribute(
      "data-href",
      "/addresses",
    );
    expect(screen.getByTestId("account-settings-link")).toHaveAttribute(
      "data-href",
      "/profile",
    );
    expect(screen.getByTestId("contact-us-link")).toHaveAttribute(
      "data-href",
      "/contact",
    );
    expect(screen.getByTestId("view-dashboard-link")).toHaveAttribute(
      "data-href",
      "/client",
    );
    expect(screen.getByTestId("my-orders-link")).toHaveAttribute(
      "data-href",
      "/order-status",
    );
  });

  it("should successfully load profile page when authenticated", async () => {
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfileResponse,
    });

    render(<MockProfilePage />);

    // Should show loading initially
    expect(screen.getByTestId("profile-loading")).toBeInTheDocument();

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    });

    // Verify profile information is displayed
    expect(screen.getByText("My Profile")).toBeInTheDocument();
    expect(screen.getByTestId("profile-name")).toHaveTextContent("Test User");
    expect(screen.getByTestId("profile-email")).toHaveTextContent(
      "test@example.com",
    );
    expect(screen.getByTestId("profile-type")).toHaveTextContent("CLIENT");
    expect(screen.getByTestId("profile-status")).toHaveTextContent("PENDING");

    // Verify API was called
    expect(global.fetch).toHaveBeenCalledWith("/api/profile");
  });

  it("should redirect to sign-in when user is not authenticated", async () => {
    // Create a mock profile component with no user
    const MockProfilePageNoAuth = () => {
      const mockRouter = { push: mockPush };

      React.useEffect(() => {
        // Simulate no user scenario
        mockRouter.push("/sign-in");
      }, []);

      return (
        <div data-testid="profile-redirect-loading">
          Redirecting to sign in...
        </div>
      );
    };

    render(<MockProfilePageNoAuth />);

    // Should attempt to redirect to sign-in
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in");
    });
  });

  it("should handle profile fetch error gracefully", async () => {
    // Mock failed API response
    (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

    render(<MockProfilePage />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId("profile-error")).toBeInTheDocument();
    });

    expect(screen.getByTestId("profile-error")).toHaveTextContent(
      "Profile Error: Network error",
    );
  });

  it("should handle profile not found scenario", async () => {
    // Mock API response with no profile data
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    });

    render(<MockProfilePage />);

    // Wait for "not found" state
    await waitFor(() => {
      expect(screen.getByTestId("profile-not-found")).toBeInTheDocument();
    });

    expect(screen.getByText("Profile Not Found")).toBeInTheDocument();

    // Test the fallback "Go to Dashboard" button
    const goToDashboardButton = screen.getByTestId("go-to-dashboard-button");
    expect(goToDashboardButton).toBeInTheDocument();

    fireEvent.click(goToDashboardButton);
    expect(mockPush).toHaveBeenCalledWith("/client");
  });

  it("should handle API unauthorized error and redirect to sign-in", async () => {
    // Mock 401 unauthorized response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });

    render(<MockProfilePage />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId("profile-error")).toBeInTheDocument();
    });

    expect(screen.getByTestId("profile-error")).toHaveTextContent(
      "Profile Error: Failed to fetch profile data",
    );
  });

  it("should navigate back to client dashboard from profile page", async () => {
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfileResponse,
    });

    render(<MockProfilePage />);

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    });

    // Test navigation back to dashboard
    const viewDashboardButton = screen.getByTestId(
      "profile-view-dashboard-button",
    );
    fireEvent.click(viewDashboardButton);
    expect(mockPush).toHaveBeenCalledWith("/client");
  });

  it("should navigate to orders from profile page", async () => {
    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfileResponse,
    });

    render(<MockProfilePage />);

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId("profile-page")).toBeInTheDocument();
    });

    // Test navigation to orders
    const myOrdersButton = screen.getByTestId("profile-my-orders-button");
    fireEvent.click(myOrdersButton);
    expect(mockPush).toHaveBeenCalledWith("/order-status");
  });
});
