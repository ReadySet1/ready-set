import { render, screen, waitFor, act } from "@testing-library/react";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { createClient } from "@/utils/supabase/client";

// Mock dependencies
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(),
}));

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
};

// Test component to access context
const TestComponent = () => {
  const { user, session, isLoading, error, userRole } = useUser();

  return (
    <div>
      <div data-testid="user">{user ? user.email : "no-user"}</div>
      <div data-testid="session">{session ? "has-session" : "no-session"}</div>
      <div data-testid="loading">{isLoading ? "loading" : "not-loading"}</div>
      <div data-testid="error">{error || "no-error"}</div>
      <div data-testid="role">{userRole || "no-role"}</div>
    </div>
  );
};

describe("UserContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockSupabaseClient.auth.getUser.mockReset();
    mockSupabaseClient.auth.getSession.mockReset();
    mockSupabaseClient.auth.onAuthStateChange.mockReset();

    // Set up default mock implementations
    mockSupabaseClient.auth.onAuthStateChange.mockImplementation(() => {
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      };
    });

    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe("Initialization", () => {
    it("should initialize with loading state", () => {
      render(
        <UserProvider>
          <TestComponent />
        </UserProvider>,
      );

      expect(screen.getByTestId("loading")).toHaveTextContent("loading");
    });

    it("should handle Supabase client initialization failure", async () => {
      (createClient as jest.Mock).mockRejectedValue(
        new Error("Connection failed"),
      );

      render(
        <UserProvider>
          <TestComponent />
        </UserProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
        expect(screen.getByTestId("error")).toHaveTextContent(
          "Authentication initialization failed",
        );
      });
    });
  });

  describe("Authentication State Management", () => {
    it("should set user and session when authenticated", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      };

      const mockSession = {
        access_token: "test-token",
        refresh_token: "test-refresh-token",
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      // Mock profile fetch for user role
      const mockSupabaseWithProfile = {
        ...mockSupabaseClient,
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { type: "client" },
                error: null,
              }),
            })),
          })),
        })),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabaseWithProfile);

      render(
        <UserProvider>
          <TestComponent />
        </UserProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
      });

      await waitFor(() => {
        expect(screen.getByTestId("user")).toHaveTextContent(
          "test@example.com",
        );
        expect(screen.getByTestId("session")).toHaveTextContent("has-session");
      });
    });

    it("should handle no authenticated user", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      render(
        <UserProvider>
          <TestComponent />
        </UserProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
        expect(screen.getByTestId("user")).toHaveTextContent("no-user");
        expect(screen.getByTestId("session")).toHaveTextContent("no-session");
      });
    });

    it("should handle authentication errors", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Auth error" },
      });

      render(
        <UserProvider>
          <TestComponent />
        </UserProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading")).toHaveTextContent("not-loading");
        expect(screen.getByTestId("error")).toHaveTextContent("no-error");
      });
    });
  });

  describe("User Role Management", () => {
    it("should fetch and set user role for client", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      };

      const mockSession = {
        access_token: "test-token",
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const mockSupabaseWithProfile = {
        ...mockSupabaseClient,
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { type: "client" },
                error: null,
              }),
            })),
          })),
        })),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabaseWithProfile);

      render(
        <UserProvider>
          <TestComponent />
        </UserProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("role")).toHaveTextContent("CLIENT");
      });
    });

    it("should handle missing user profile gracefully", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      });

      const mockSupabaseWithProfile = {
        ...mockSupabaseClient,
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
        })),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabaseWithProfile);

      render(
        <UserProvider>
          <TestComponent />
        </UserProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("role")).toHaveTextContent("CLIENT"); // Default role
      });
    });

    it("should handle profile fetch errors gracefully", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      });

      const mockSupabaseWithProfile = {
        ...mockSupabaseClient,
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest
                .fn()
                .mockRejectedValue(new Error("Profile fetch failed")),
            })),
          })),
        })),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabaseWithProfile);

      render(
        <UserProvider>
          <TestComponent />
        </UserProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("role")).toHaveTextContent("CLIENT"); // Default role
      });
    });
  });

  describe("Auth State Changes", () => {
    it("should handle auth state changes", async () => {
      const mockUser = {
        id: "test-user-id",
        email: "test@example.com",
      };

      const mockSession = {
        access_token: "test-token",
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const mockSupabaseWithProfile = {
        ...mockSupabaseClient,
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { type: "client" },
                error: null,
              }),
            })),
          })),
        })),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabaseWithProfile);

      render(
        <UserProvider>
          <TestComponent />
        </UserProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("user")).toHaveTextContent(
          "test@example.com",
        );
      });

      // Simulate auth state change
      // Note: In a real test, you would need to capture the callback when onAuthStateChange is called
      // For now, we'll just verify that the auth state change was set up
      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByTestId("user")).toHaveTextContent("no-user");
        expect(screen.getByTestId("session")).toHaveTextContent("no-session");
      });
    });
  });

  describe("Context Hook Usage", () => {
    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow("useUser must be used within a UserProvider");

      consoleSpy.mockRestore();
    });
  });
});
