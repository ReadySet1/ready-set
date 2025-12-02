import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UserAddresses from "@/components/AddressManager/UserAddresses";

// Create a wrapper with QueryClientProvider for tests
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock Next.js router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => {
    // Helper to create a chainable query builder mock
    const createMockQueryBuilder = (returnData: any = null) => {
      const builder: any = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: returnData, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: returnData, error: null }),
      };
      return builder;
    };

    return {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user1", email: "test@example.com", user_metadata: { role: "client" } } },
          error: null,
        }),
        onAuthStateChange: jest.fn().mockReturnValue({
          data: { subscription: { unsubscribe: jest.fn() } },
        }),
      },
      from: jest.fn((table: string) => {
        if (table === "profiles") {
          return createMockQueryBuilder({ type: "client" });
        }
        return createMockQueryBuilder();
      }),
    };
  }),
}));

// Mock all problematic components with simple implementations
jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, className }: any) => (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/spinner", () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

jest.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => (
    <table>{children}</table>
  ),
  TableHeader: ({ children }: { children: React.ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: { children: React.ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children }: { children: React.ReactNode }) => (
    <tr>{children}</tr>
  ),
  TableHead: ({ children }: { children: React.ReactNode }) => (
    <th>{children}</th>
  ),
  TableCell: ({ children }: { children: React.ReactNode }) => (
    <td>{children}</td>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, defaultValue }: any) => (
    <div data-testid="tabs" data-value={defaultValue}>
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({ children, value }: any) => (
    <button data-testid={`tab-${value}`}>{children}</button>
  ),
  TabsContent: ({ children, value }: any) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
}));

jest.mock("@/components/AddressManager/AddressModal", () => {
  return function MockAddressModal({ isOpen }: any) {
    if (!isOpen) return null;
    return <div data-testid="address-modal">Modal Content</div>;
  };
});

/**
 * TODO: REA-211 - UserAddresses integration tests have component rendering issues
 */
describe.skip("UserAddresses Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Text Title Styling Integration", () => {
    it("should render the title with correct styling classes", async () => {
      render(<UserAddresses />, { wrapper: createWrapper() });

      await waitFor(() => {
        const title = screen.getByText("Your Addresses");
        expect(title).toBeInTheDocument();

        // Check that the title has the correct classes
        expect(title.className).toContain("text-center");
        expect(title.className).toContain("text-3xl");
        expect(title.className).toContain("font-semibold");
      });
    });

    it("should render the subheading with correct styling classes", async () => {
      render(<UserAddresses />, { wrapper: createWrapper() });

      await waitFor(() => {
        const subheading = screen.getByText(
          "Manage your saved addresses for deliveries and pickups",
        );
        expect(subheading).toBeInTheDocument();

        // Check that the subheading has the correct classes
        expect(subheading.className).toContain("text-center");
        expect(subheading.className).toContain("text-sm");
        expect(subheading.className).toContain("text-slate-500");
      });
    });

    it("should have proper container styling with bottom padding", async () => {
      render(<UserAddresses />, { wrapper: createWrapper() });

      await waitFor(() => {
        const title = screen.getByText("Your Addresses");
        const container = title.closest("div");

        expect(container).toBeInTheDocument();
        expect(container?.className).toContain("mb-4");
        expect(container?.className).toContain("flex");
        expect(container?.className).toContain("items-center");
        expect(container?.className).toContain("justify-center");
      });
    });

    it("should maintain proper spacing between title elements", async () => {
      render(<UserAddresses />, { wrapper: createWrapper() });

      await waitFor(() => {
        const subheading = screen.getByText(
          "Manage your saved addresses for deliveries and pickups",
        );
        expect(subheading.className).toContain("mt-2");
      });
    });
  });

  describe("Component Structure", () => {
    it("should render the main component structure", async () => {
      render(<UserAddresses />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Check that the main title and subheading are present
        expect(screen.getByText("Your Addresses")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Manage your saved addresses for deliveries and pickups",
          ),
        ).toBeInTheDocument();

        // Check that tabs are rendered
        expect(screen.getByTestId("tabs")).toBeInTheDocument();
        expect(screen.getByText("All Addresses")).toBeInTheDocument();
        expect(screen.getByText("Your Private Addresses")).toBeInTheDocument();
        expect(screen.getByText("Shared Addresses")).toBeInTheDocument();

        // Check that the add button is present
        expect(screen.getByText("+ Add New Address")).toBeInTheDocument();
      });
    });

    it("should render tabs with correct structure", async () => {
      render(<UserAddresses />, { wrapper: createWrapper() });

      await waitFor(() => {
        const tabsList = screen.getByTestId("tabs-list");
        expect(tabsList).toBeInTheDocument();

        // Check individual tab triggers
        expect(screen.getByTestId("tab-all")).toBeInTheDocument();
        expect(screen.getByTestId("tab-private")).toBeInTheDocument();
        expect(screen.getByTestId("tab-shared")).toBeInTheDocument();
      });
    });
  });

  describe("Visual Layout", () => {
    it("should center the title text properly", async () => {
      render(<UserAddresses />, { wrapper: createWrapper() });

      await waitFor(() => {
        const title = screen.getByText("Your Addresses");
        const titleElement = title as HTMLElement;

        // The text-center class should be applied
        expect(titleElement.className).toContain("text-center");
      });
    });

    it("should center the subheading text properly", async () => {
      render(<UserAddresses />, { wrapper: createWrapper() });

      await waitFor(() => {
        const subheading = screen.getByText(
          "Manage your saved addresses for deliveries and pickups",
        );
        const subheadingElement = subheading as HTMLElement;

        // The text-center class should be applied
        expect(subheadingElement.className).toContain("text-center");
      });
    });

    it("should apply proper padding around the title section", async () => {
      render(<UserAddresses />, { wrapper: createWrapper() });

      await waitFor(() => {
        const title = screen.getByText("Your Addresses");
        const container = title.closest("div");

        // Check that the container has the mb-4 class for bottom padding
        expect(container?.className).toContain("mb-4");
      });
    });
  });
});
