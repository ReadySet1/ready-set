import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter } from "next/navigation";
import Header from "../index";
import { useUser } from "@/contexts/UserContext";
import { UserType } from "@/types/user";

// Mock dependencies
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock("@/contexts/UserContext", () => ({
  useUser: jest.fn(),
}));

jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      signOut: jest.fn(),
    },
  })),
}));

jest.mock("next/image", () => {
  return function MockImage(props: any) {
    return <img {...props} alt={props.alt || ""} />;
  };
});

jest.mock("../MobileMenu", () => {
  return function MockMobileMenu() {
    return <div data-testid="mobile-menu">Mobile Menu</div>;
  };
});

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  refresh: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
};

const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

// Default mock user context
const defaultMockUserContext = {
  session: null,
  user: null,
  userRole: null,
  isLoading: false,
  error: null,
  isAuthenticating: false,
  authProgress: { step: "idle" as const, message: "" },
  refreshUserData: jest.fn(),
  clearAuthError: jest.fn(),
  setAuthProgress: jest.fn(),
};

describe("Header Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);
    mockUsePathname.mockReturnValue("/");

    // Mock window scroll behavior
    Object.defineProperty(window, "scrollY", {
      writable: true,
      value: 0,
    });

    // Mock location for sign out
    delete (window as any).location;
    window.location = { href: "" } as any;
  });

  describe("rendering", () => {
    it("should render header with default state", () => {
      mockUseUser.mockReturnValue(defaultMockUserContext);

      render(<Header />);

      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(screen.getByTestId("mobile-menu")).toBeInTheDocument();
    });

    it("should apply sticky styles when scrolled", () => {
      mockUseUser.mockReturnValue(defaultMockUserContext);

      const { rerender } = render(<Header />);

      // Simulate scroll
      Object.defineProperty(window, "scrollY", { value: 100 });
      fireEvent.scroll(window);

      rerender(<Header />);

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("fixed", "shadow-nav");
    });
  });

  describe("authentication state - logged out", () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue(defaultMockUserContext);
    });

    it("should show Sign In and Sign Up buttons when logged out on home page", () => {
      mockUsePathname.mockReturnValue("/");

      render(<Header />);

      expect(screen.getByText("Sign In")).toBeInTheDocument();
      expect(screen.getByText("Sign Up")).toBeInTheDocument();
    });

    it("should show Sign In and Sign Up buttons when logged out on other pages", () => {
      mockUsePathname.mockReturnValue("/about");

      render(<Header />);

      expect(screen.getByText("Sign In")).toBeInTheDocument();
      expect(screen.getByText("Sign Up")).toBeInTheDocument();
    });

    it("should show Sign In and Sign Up buttons on virtual assistant page", () => {
      mockUsePathname.mockReturnValue("/va");

      render(<Header />);

      expect(screen.getByText("Sign In")).toBeInTheDocument();
      expect(screen.getByText("Sign Up")).toBeInTheDocument();
    });

    it("should have correct links for Sign In and Sign Up buttons", () => {
      render(<Header />);

      const signInLink = screen.getByText("Sign In").closest("a");
      const signUpLink = screen.getByText("Sign Up").closest("a");

      expect(signInLink).toHaveAttribute("href", "/sign-in");
      expect(signUpLink).toHaveAttribute("href", "/sign-up");
    });
  });

  describe("authentication state - logged in", () => {
    const mockUser = { id: "test-user", email: "test@example.com" } as any;
    const mockSession = { user: mockUser } as any;

    it("should show vendor dashboard link when logged in as vendor", () => {
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.VENDOR,
      });

      render(<Header />);

      expect(screen.getByText("Vendor Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
      expect(screen.queryByText("Sign Up")).not.toBeInTheDocument();
    });

    it("should show client dashboard link when logged in as client", () => {
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.CLIENT,
      });

      render(<Header />);

      expect(screen.getByText("Client Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });

    it("should show admin dashboard link when logged in as admin", () => {
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.ADMIN,
      });

      render(<Header />);

      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });

    it("should show driver dashboard link when logged in as driver", () => {
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.DRIVER,
      });

      render(<Header />);

      // Driver role uses "Dashboard" as the link text
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });

    it("should show helpdesk portal link when logged in as helpdesk", () => {
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.HELPDESK,
      });

      render(<Header />);

      expect(screen.getByText("Helpdesk Portal")).toBeInTheDocument();
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });

    it("should have correct dashboard links for each role", () => {
      const roles = [
        { type: UserType.VENDOR, path: "/client" },
        { type: UserType.CLIENT, path: "/client" },
        { type: UserType.ADMIN, path: "/admin" },
        { type: UserType.DRIVER, path: "/driver" },
        { type: UserType.HELPDESK, path: "/admin" },
      ];

      roles.forEach(({ type, path }) => {
        mockUseUser.mockReturnValue({
          ...defaultMockUserContext,
          user: mockUser,
          session: mockSession,
          userRole: type,
        });

        const { rerender } = render(<Header />);

        const dashboardLink = screen
          .getByText(new RegExp("Dashboard|Portal"))
          .closest("a");
        expect(dashboardLink).toHaveAttribute("href", path);

        rerender(<div />); // Clear for next iteration
      });
    });
  });

  describe("sign out functionality", () => {
    const mockUser = { id: "test-user", email: "test@example.com" } as any;
    const mockSession = { user: mockUser } as any;

    it("should handle sign out when button is clicked", async () => {
      const mockSupabase = {
        auth: {
          signOut: jest.fn().mockResolvedValue({}),
        },
      };

      const { createClient } = await import("@/utils/supabase/client");
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.VENDOR,
      });

      const user = userEvent.setup();
      render(<Header />);

      const signOutButton = screen.getByText("Sign Out");
      await user.click(signOutButton);

      await waitFor(() => {
        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
      });

      // jsdom normalizes "/" to "http://localhost/"
      expect(window.location.href).toContain("/");
    });

    it("should show signing out state", async () => {
      const mockSupabase = {
        auth: {
          signOut: jest
            .fn()
            .mockImplementation(
              () => new Promise((resolve) => setTimeout(resolve, 100)),
            ),
        },
      };

      const { createClient } = await import("@/utils/supabase/client");
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.VENDOR,
      });

      const user = userEvent.setup();
      render(<Header />);

      const signOutButton = screen.getByText("Sign Out");
      await user.click(signOutButton);

      expect(screen.getByText("Signing Out...")).toBeInTheDocument();
    });

    it("should handle sign out errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const mockSupabase = {
        auth: {
          signOut: jest.fn().mockRejectedValue(new Error("Sign out failed")),
        },
      };

      const { createClient } = await import("@/utils/supabase/client");
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.VENDOR,
      });

      const user = userEvent.setup();
      render(<Header />);

      const signOutButton = screen.getByText("Sign Out");
      await user.click(signOutButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error signing out:",
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("loading state", () => {
    it("should handle loading state gracefully", () => {
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        isLoading: true,
      });

      render(<Header />);

      // Header should still render during loading
      expect(screen.getByRole("banner")).toBeInTheDocument();
      // Auth buttons should not be visible during loading
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
      expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
    });
  });

  describe("responsive behavior", () => {
    it("should show mobile menu toggle button", () => {
      mockUseUser.mockReturnValue(defaultMockUserContext);

      render(<Header />);

      const mobileToggle = screen.getByLabelText("Mobile Menu");
      expect(mobileToggle).toBeInTheDocument();
    });

    it("should toggle mobile menu when button is clicked", async () => {
      mockUseUser.mockReturnValue(defaultMockUserContext);

      const user = userEvent.setup();
      render(<Header />);

      const mobileToggle = screen.getByLabelText("Mobile Menu");
      await user.click(mobileToggle);

      // Check if toggle state changed (visual change in button)
      const toggleSpans = mobileToggle.querySelectorAll("span");
      expect(toggleSpans).toHaveLength(3);
    });
  });

  describe("page-specific styling", () => {
    it("should apply correct styles on home page", () => {
      mockUsePathname.mockReturnValue("/");
      mockUseUser.mockReturnValue(defaultMockUserContext);

      render(<Header />);

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("absolute", "bg-transparent");
    });

    it("should apply correct styles on virtual assistant page", () => {
      mockUsePathname.mockReturnValue("/va");
      mockUseUser.mockReturnValue(defaultMockUserContext);

      render(<Header />);

      // Header should handle VA page styling
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });

    it("should apply correct styles on other pages", () => {
      mockUsePathname.mockReturnValue("/about");
      mockUseUser.mockReturnValue(defaultMockUserContext);

      render(<Header />);

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("absolute", "bg-transparent");
    });
  });

  describe("authentication state changes", () => {
    it("should update header immediately when user logs in", () => {
      const mockUser = { id: "test-user", email: "test@example.com" } as any;
      const mockSession = { user: mockUser } as any;

      // Start with logged out state
      mockUseUser.mockReturnValue(defaultMockUserContext);

      const { rerender } = render(<Header />);

      expect(screen.getByText("Sign In")).toBeInTheDocument();
      expect(screen.getByText("Sign Up")).toBeInTheDocument();

      // Simulate user login by changing the context
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.VENDOR,
      });

      rerender(<Header />);

      // Should immediately show logged in state
      expect(screen.getByText("Vendor Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
      expect(screen.queryByText("Sign Up")).not.toBeInTheDocument();
    });

    it("should update header immediately when user logs out", () => {
      const mockUser = { id: "test-user", email: "test@example.com" } as any;
      const mockSession = { user: mockUser } as any;

      // Start with logged in state
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.VENDOR,
      });

      const { rerender } = render(<Header />);

      expect(screen.getByText("Vendor Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Sign Out")).toBeInTheDocument();

      // Simulate user logout by changing the context
      mockUseUser.mockReturnValue(defaultMockUserContext);

      rerender(<Header />);

      // Should immediately show logged out state
      expect(screen.getByText("Sign In")).toBeInTheDocument();
      expect(screen.getByText("Sign Up")).toBeInTheDocument();
      expect(screen.queryByText("Vendor Dashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
    });

    it("should update when user role changes", () => {
      const mockUser = { id: "test-user", email: "test@example.com" } as any;
      const mockSession = { user: mockUser } as any;

      // Start as vendor
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.VENDOR,
      });

      const { rerender } = render(<Header />);

      expect(screen.getByText("Vendor Dashboard")).toBeInTheDocument();

      // Change to admin role
      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.ADMIN,
      });

      rerender(<Header />);

      // Should show admin dashboard
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
      expect(screen.queryByText("Vendor Dashboard")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper ARIA labels", () => {
      mockUseUser.mockReturnValue(defaultMockUserContext);

      render(<Header />);

      const mobileToggle = screen.getByLabelText("Mobile Menu");
      expect(mobileToggle).toBeInTheDocument();
    });

    it("should have proper semantic HTML structure", () => {
      mockUseUser.mockReturnValue(defaultMockUserContext);

      render(<Header />);

      const header = screen.getByRole("banner");
      expect(header.tagName).toBe("HEADER");
    });

    it("should disable sign out button during sign out process", async () => {
      const mockUser = { id: "test-user", email: "test@example.com" } as any;
      const mockSession = { user: mockUser } as any;

      const mockSupabase = {
        auth: {
          signOut: jest
            .fn()
            .mockImplementation(
              () => new Promise((resolve) => setTimeout(resolve, 100)),
            ),
        },
      };

      const { createClient } = await import("@/utils/supabase/client");
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      mockUseUser.mockReturnValue({
        ...defaultMockUserContext,
        user: mockUser,
        session: mockSession,
        userRole: UserType.VENDOR,
      });

      const user = userEvent.setup();
      render(<Header />);

      const signOutButton = screen.getByText("Sign Out");
      await user.click(signOutButton);

      const signingOutButton = screen.getByText("Signing Out...");
      expect(signingOutButton).toBeDisabled();
    });
  });
});
