// src/__tests__/components/Header/Header.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { usePathname } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import Header from "@/components/Header/index";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  usePathname: vi.fn(),
}));

// Mock UserContext
vi.mock("@/contexts/UserContext", () => ({
  useUser: vi.fn(),
}));

// Mock Supabase client
vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        signOut: vi.fn(),
      },
    }),
  ),
}));

describe("Header Component", () => {
  const mockUsePathname = usePathname as any;
  const mockUseUser = useUser as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Sign In and Sign Up buttons", () => {
    it("should show Sign In and Sign Up buttons when user is not authenticated on non-home pages", () => {
      mockUsePathname.mockReturnValue("/about");
      mockUseUser.mockReturnValue({
        user: null,
        userRole: null,
        isLoading: false,
      });

      render(<Header />);

      // Check for Sign In button
      const signInButtons = screen.getAllByText("Sign In");
      expect(signInButtons.length).toBeGreaterThan(0);

      // Check for Sign Up button
      const signUpButtons = screen.getAllByText("Sign Up");
      expect(signUpButtons.length).toBeGreaterThan(0);
    });

    it("should show Sign In and Sign Up buttons when user is not authenticated on other pages", () => {
      mockUsePathname.mockReturnValue("/about");
      mockUseUser.mockReturnValue({
        user: null,
        userRole: null,
        isLoading: false,
      });

      render(<Header />);

      // Check for Sign In button
      const signInButtons = screen.getAllByText("Sign In");
      expect(signInButtons.length).toBeGreaterThan(0);

      // Check for Sign Up button
      const signUpButtons = screen.getAllByText("Sign Up");
      expect(signUpButtons.length).toBeGreaterThan(0);
    });

    it("should not show Sign In and Sign Up buttons when user is authenticated", () => {
      mockUsePathname.mockReturnValue("/about");
      mockUseUser.mockReturnValue({
        user: { id: "test-user", email: "test@example.com" },
        userRole: "CLIENT",
        isLoading: false,
      });

      render(<Header />);

      // Check that Sign In and Sign Up buttons are not present
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
      expect(screen.queryByText("Sign Up")).not.toBeInTheDocument();

      // Should show Sign Out button instead
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });

    it("should not show buttons when loading", () => {
      mockUsePathname.mockReturnValue("/about");
      mockUseUser.mockReturnValue({
        user: null,
        userRole: null,
        isLoading: true,
      });

      render(<Header />);

      // Should not show any auth buttons while loading
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
      expect(screen.queryByText("Sign Up")).not.toBeInTheDocument();
      expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
    });
  });

  describe("Button links", () => {
    it("should have correct href attributes for Sign In and Sign Up buttons", () => {
      mockUsePathname.mockReturnValue("/about");
      mockUseUser.mockReturnValue({
        user: null,
        userRole: null,
        isLoading: false,
      });

      render(<Header />);

      // Find links by their href attribute
      const signInLinks = screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href") === "/sign-in");
      const signUpLinks = screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href") === "/sign-up");

      expect(signInLinks.length).toBeGreaterThan(0);
      expect(signUpLinks.length).toBeGreaterThan(0);
    });
  });
});
