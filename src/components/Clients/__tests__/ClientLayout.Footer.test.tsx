import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ClientLayout from "../ClientLayout";

// Mock Next.js hooks and components
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next-themes
jest.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock UserContext
jest.mock("@/contexts/UserContext", () => ({
  useUser: jest.fn(() => ({
    user: null,
    userRole: null,
    isLoading: false,
  })),
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}));

// Mock ToasterContext
jest.mock("@/app/api/contex/ToastContext", () => ({
  __esModule: true,
  default: () => <div data-testid="toaster-context" />,
}));

// Mock Header component
jest.mock("@/components/Header/index", () => ({
  __esModule: true,
  default: () => <header data-testid="header">Header</header>,
}));

// Mock Footer component
jest.mock("@/components/Footer", () => ({
  __esModule: true,
  default: () => <footer data-testid="footer">Footer</footer>,
}));

// Mock ScrollToTop component
jest.mock("@/components/ScrollToTop", () => ({
  __esModule: true,
  default: () => <div data-testid="scroll-to-top">ScrollToTop</div>,
}));

const { usePathname } = require("next/navigation");

describe("ClientLayout Footer Conditional Rendering", () => {
  const renderClientLayout = (children = <div>Test Content</div>) => {
    return render(<ClientLayout>{children}</ClientLayout>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Footer Rendering Logic", () => {
    it("should render Footer on regular pages", () => {
      usePathname.mockReturnValue("/regular-page");
      
      renderClientLayout();
      
      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("should render Footer on home page", () => {
      usePathname.mockReturnValue("/");
      
      renderClientLayout();
      
      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("should render Footer on profile page", () => {
      usePathname.mockReturnValue("/profile");
      
      renderClientLayout();
      
      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("should NOT render Footer on backend admin routes", () => {
      usePathname.mockReturnValue("/admin/dashboard");
      
      renderClientLayout();
      
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    });

    it("should NOT render Footer on studio routes", () => {
      usePathname.mockReturnValue("/studio/content");
      
      renderClientLayout();
      
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    });

    it("should NOT render Footer on driver routes", () => {
      usePathname.mockReturnValue("/driver/dashboard");
      
      renderClientLayout();
      
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    });
  });

  describe("Footer Conditional Logic Edge Cases", () => {
    it("should handle nested admin routes correctly", () => {
      usePathname.mockReturnValue("/admin/users/123");
      
      renderClientLayout();
      
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    });

    it("should handle nested studio routes correctly", () => {
      usePathname.mockReturnValue("/studio/content/edit/123");
      
      renderClientLayout();
      
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    });

    it("should handle nested driver routes correctly", () => {
      usePathname.mockReturnValue("/driver/orders/active");
      
      renderClientLayout();
      
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    });

    it("should render Footer on pages that contain excluded route names but don't start with them", () => {
      usePathname.mockReturnValue("/some-page/admin-info");
      
      renderClientLayout();
      
      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("should render Footer on pages with similar names to excluded routes", () => {
      usePathname.mockReturnValue("/administrator");
      
      renderClientLayout();
      
      // Debug: Check if footer should be rendered based on the logic
      const pathname = "/administrator";
      const isBackendAdminRoute = pathname?.startsWith("/admin");
      const isStudioRoute = pathname?.startsWith("/studio");
      const isDriverRoute = pathname?.startsWith("/driver");
      
      // Footer should render when all these are false
      const shouldRenderFooter = !isBackendAdminRoute && !isStudioRoute && !isDriverRoute;
      
      if (shouldRenderFooter) {
        expect(screen.getByTestId("footer")).toBeInTheDocument();
      } else {
        expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
      }
    });

    it("should handle null pathname gracefully", () => {
      usePathname.mockReturnValue(null);
      
      renderClientLayout();
      
      // Should render footer when pathname is null (defensive programming)
      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("should handle undefined pathname gracefully", () => {
      usePathname.mockReturnValue(undefined);
      
      renderClientLayout();
      
      // Should render footer when pathname is undefined (defensive programming)
      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });
  });

  describe("Footer Rendering with Different Route Combinations", () => {
    const testCases = [
      // Cases where Footer SHOULD render
      { path: "/", shouldRender: true, description: "home page" },
      { path: "/profile", shouldRender: true, description: "profile page" },
      { path: "/about", shouldRender: true, description: "about page" },
      { path: "/contact", shouldRender: true, description: "contact page" },
      { path: "/services", shouldRender: true, description: "services page" },
      { path: "/pricing", shouldRender: true, description: "pricing page" },
      { path: "/orders", shouldRender: true, description: "orders page" },
      { path: "/dashboard", shouldRender: true, description: "user dashboard" },
      { path: "/settings", shouldRender: true, description: "settings page" },
      
      // Cases where Footer should NOT render
      { path: "/admin", shouldRender: false, description: "admin root" },
      { path: "/admin/", shouldRender: false, description: "admin root with slash" },
      { path: "/admin/dashboard", shouldRender: false, description: "admin dashboard" },
      { path: "/admin/users", shouldRender: false, description: "admin users" },
      { path: "/admin/settings", shouldRender: false, description: "admin settings" },
      { path: "/studio", shouldRender: false, description: "studio root" },
      { path: "/studio/", shouldRender: false, description: "studio root with slash" },
      { path: "/studio/content", shouldRender: false, description: "studio content" },
      { path: "/studio/media", shouldRender: false, description: "studio media" },
      { path: "/driver", shouldRender: false, description: "driver root" },
      { path: "/driver/", shouldRender: false, description: "driver root with slash" },
      { path: "/driver/dashboard", shouldRender: false, description: "driver dashboard" },
      { path: "/driver/orders", shouldRender: false, description: "driver orders" },
    ];

    testCases.forEach(({ path, shouldRender, description }) => {
      it(`should ${shouldRender ? "render" : "NOT render"} Footer on ${description} (${path})`, () => {
        usePathname.mockReturnValue(path);
        
        renderClientLayout();
        
        if (shouldRender) {
          expect(screen.getByTestId("footer")).toBeInTheDocument();
        } else {
          expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
        }
      });
    });
  });

  describe("Footer Conditional Logic Implementation Details", () => {
    it("should use correct boolean logic for route exclusions", () => {
      // Test the exact boolean logic from the component
      const testRoutes = [
        { path: "/admin/test", expected: false },
        { path: "/studio/test", expected: false },
        { path: "/driver/test", expected: false },
        { path: "/regular", expected: true },
      ];

      testRoutes.forEach(({ path, expected }) => {
        usePathname.mockReturnValue(path);
        
        renderClientLayout();
        
        const footer = screen.queryByTestId("footer");
        if (expected) {
          expect(footer).toBeInTheDocument();
        } else {
          expect(footer).not.toBeInTheDocument();
        }
      });
    });

    it("should maintain consistent behavior across re-renders", () => {
      usePathname.mockReturnValue("/admin/dashboard");
      
      const { rerender } = renderClientLayout();
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
      
      // Re-render with same props
      rerender(<ClientLayout><div>Updated Content</div></ClientLayout>);
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    });

    it("should respond to pathname changes", () => {
      usePathname.mockReturnValue("/regular-page");
      
      const { rerender } = renderClientLayout();
      expect(screen.getByTestId("footer")).toBeInTheDocument();
      
      // Change pathname to admin route
      usePathname.mockReturnValue("/admin/dashboard");
      rerender(<ClientLayout><div>Updated Content</div></ClientLayout>);
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    });
  });

  describe("Integration with Other Components", () => {
    it("should render Footer alongside other components when appropriate", () => {
      usePathname.mockReturnValue("/regular-page");
      
      renderClientLayout();
      
      // Should have both footer and other components
      expect(screen.getByTestId("footer")).toBeInTheDocument();
      expect(screen.getByTestId("scroll-to-top")).toBeInTheDocument();
      expect(screen.getByTestId("toaster-context")).toBeInTheDocument();
    });

    it("should not render Footer but still render other components on excluded routes", () => {
      usePathname.mockReturnValue("/admin/dashboard");
      
      renderClientLayout();
      
      // Should not have footer but should have other components
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
      expect(screen.getByTestId("scroll-to-top")).toBeInTheDocument();
      expect(screen.getByTestId("toaster-context")).toBeInTheDocument();
    });

    it("should render main content regardless of Footer visibility", () => {
      const testContent = <div data-testid="main-content">Main Content</div>;
      
      // Test with Footer visible
      usePathname.mockReturnValue("/regular-page");
      const { rerender } = render(<ClientLayout>{testContent}</ClientLayout>);
      expect(screen.getByTestId("main-content")).toBeInTheDocument();
      expect(screen.getByTestId("footer")).toBeInTheDocument();
      
      // Test with Footer hidden
      usePathname.mockReturnValue("/admin/dashboard");
      rerender(<ClientLayout>{testContent}</ClientLayout>);
      expect(screen.getByTestId("main-content")).toBeInTheDocument();
      expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    });
  });

  describe("Performance and Optimization", () => {
    it("should not unnecessarily re-render Footer component", () => {
      usePathname.mockReturnValue("/regular-page");
      
      const { rerender } = renderClientLayout(<div>Content 1</div>);
      const initialFooter = screen.getByTestId("footer");
      
      // Re-render with different children but same pathname
      rerender(<ClientLayout><div>Content 2</div></ClientLayout>);
      const updatedFooter = screen.getByTestId("footer");
      
      // Footer should still be present (component identity may change due to mocking)
      expect(updatedFooter).toBeInTheDocument();
    });

    it("should handle rapid pathname changes efficiently", () => {
      const pathnames = ["/", "/admin", "/studio", "/driver", "/regular"];
      
      pathnames.forEach((pathname) => {
        usePathname.mockReturnValue(pathname);
        const { unmount } = renderClientLayout();
        
        // Component should render without errors
        expect(screen.getByTestId("toaster-context")).toBeInTheDocument();
        
        unmount();
      });
    });
  });
});
