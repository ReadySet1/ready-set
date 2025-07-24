// src/__tests__/components/ClientLayout/ClientLayout.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { usePathname } from "next/navigation";
import ClientLayout from "@/components/Clients/ClientLayout";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock Header component
vi.mock("@/components/Header/index", () => ({
  default: () => <div data-testid="header-component">Header Component</div>,
}));

// Mock Footer component
vi.mock("@/components/Footer", () => ({
  default: () => <div data-testid="footer-component">Footer Component</div>,
}));

// Mock ScrollToTop component
vi.mock("@/components/ScrollToTop", () => ({
  default: () => <div data-testid="scroll-to-top">ScrollToTop</div>,
}));

// Mock ToasterContext
vi.mock("@/app/api/contex/ToastContext", () => ({
  default: () => <div data-testid="toaster-context">ToasterContext</div>,
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: vi.fn(),
}));

describe("ClientLayout", () => {
  const mockUsePathname = usePathname as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Header rendering based on pathname", () => {
    it("should NOT render Header on homepage", () => {
      mockUsePathname.mockReturnValue("/");

      render(
        <ClientLayout>
          <div>Test Content</div>
        </ClientLayout>,
      );

      // Header should NOT be present on homepage
      expect(screen.queryByTestId("header-component")).not.toBeInTheDocument();

      // Footer should still be present
      expect(screen.getByTestId("footer-component")).toBeInTheDocument();

      // Content should be present
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("should render Header on about page", () => {
      mockUsePathname.mockReturnValue("/about");

      render(
        <ClientLayout>
          <div>Test Content</div>
        </ClientLayout>,
      );

      // Header should be present on non-home pages
      expect(screen.getByTestId("header-component")).toBeInTheDocument();

      // Footer should be present
      expect(screen.getByTestId("footer-component")).toBeInTheDocument();

      // Content should be present
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("should render Header on contact page", () => {
      mockUsePathname.mockReturnValue("/contact");

      render(
        <ClientLayout>
          <div>Test Content</div>
        </ClientLayout>,
      );

      // Header should be present on non-home pages
      expect(screen.getByTestId("header-component")).toBeInTheDocument();

      // Footer should be present
      expect(screen.getByTestId("footer-component")).toBeInTheDocument();
    });

    it("should render Header on any other page", () => {
      mockUsePathname.mockReturnValue("/join-the-team");

      render(
        <ClientLayout>
          <div>Test Content</div>
        </ClientLayout>,
      );

      // Header should be present on non-home pages
      expect(screen.getByTestId("header-component")).toBeInTheDocument();

      // Footer should be present
      expect(screen.getByTestId("footer-component")).toBeInTheDocument();
    });

    it("should NOT render Header on profile page", () => {
      mockUsePathname.mockReturnValue("/profile");

      render(
        <ClientLayout>
          <div>Test Content</div>
        </ClientLayout>,
      );

      // Header should NOT be present on profile page
      expect(screen.queryByTestId("header-component")).not.toBeInTheDocument();

      // Footer should still be present
      expect(screen.getByTestId("footer-component")).toBeInTheDocument();
    });

    it("should NOT render Header or Footer on admin pages", () => {
      mockUsePathname.mockReturnValue("/admin/dashboard");

      render(
        <ClientLayout>
          <div>Test Content</div>
        </ClientLayout>,
      );

      // Neither Header nor Footer should be present on admin pages
      expect(screen.queryByTestId("header-component")).not.toBeInTheDocument();
      expect(screen.queryByTestId("footer-component")).not.toBeInTheDocument();

      // Content should still be present
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });
  });
});
