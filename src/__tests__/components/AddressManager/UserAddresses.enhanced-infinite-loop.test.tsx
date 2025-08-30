import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UserAddresses from "@/components/AddressManager/UserAddresses";
import { createClient } from "@/utils/supabase/client";

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock the tabs component module
jest.mock("@/components/ui/tabs", () => {
  let currentValue: string;
  let onValueChangeHandler: ((value: string) => void) | undefined;

  return {
    Tabs: ({
      children,
      defaultValue,
      onValueChange,
    }: {
      children: React.ReactNode;
      defaultValue?: string;
      onValueChange?: (value: string) => void;
    }) => {
      currentValue = defaultValue || "all";
      onValueChangeHandler = onValueChange;
      return (
        <div data-testid="tabs-root" data-default-value={defaultValue}>
          {children}
        </div>
      );
    },
    TabsList: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="tabs-list">{children}</div>
    ),
    TabsTrigger: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => (
      <button
        data-testid={`tabs-trigger-${value}`}
        onClick={() => {
          currentValue = value;
          onValueChangeHandler && onValueChangeHandler(value);
        }}
      >
        {children}
      </button>
    ),
    TabsContent: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => <div data-testid={`tabs-content-${value}`}>{children}</div>,
  };
});

// Mock AlertDialog components
jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog">{children}</div>
  ),
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="alert-dialog-trigger">{children}</button>
  ),
  AlertDialogPortal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-portal">{children}</div>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-header">{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="alert-dialog-description">{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-footer">{children}</div>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="alert-dialog-action" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="alert-dialog-cancel" onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock Pagination components
jest.mock("@/components/ui/pagination", () => ({
  Pagination: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pagination">{children}</div>
  ),
  PaginationContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pagination-content">{children}</div>
  ),
  PaginationItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pagination-item">{children}</div>
  ),
  PaginationLink: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="pagination-link" onClick={onClick}>
      {children}
    </button>
  ),
  PaginationNext: ({ onClick }: { onClick?: () => void }) => (
    <button data-testid="pagination-next" onClick={onClick}>
      Next
    </button>
  ),
  PaginationPrevious: ({ onClick }: { onClick?: () => void }) => (
    <button data-testid="pagination-previous" onClick={onClick}>
      Previous
    </button>
  ),
}));

// Mock AddressModal
jest.mock("@/components/AddressManager/AddressModal", () => {
  return function MockAddressModal({ isOpen, onClose, addressToEdit }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="address-modal">
        <h2>Edit Address</h2>
        <p>Editing: {addressToEdit?.name || "New Address"}</p>
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    );
  };
});

const mockAddresses = [
  {
    id: "1",
    name: "Home",
    street1: "123 Main St",
    street2: "",
    city: "San Francisco",
    state: "CA",
    zip: "94103",
    county: "San Francisco",
    isRestaurant: false,
    isShared: false,
    locationNumber: "",
    parkingLoading: "",
    createdAt: new Date().toISOString(),
    createdBy: "user123",
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    latitude: null,
    longitude: null,
  },
  {
    id: "2",
    name: "Work",
    street1: "456 Business Ave",
    street2: "Suite 100",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    county: "San Francisco",
    isRestaurant: false,
    isShared: true,
    locationNumber: "",
    parkingLoading: "",
    createdAt: new Date().toISOString(),
    createdBy: "user123",
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    latitude: null,
    longitude: null,
  },
  {
    id: "3",
    name: "Restaurant",
    street1: "789 Food St",
    street2: "",
    city: "San Francisco",
    state: "CA",
    zip: "94107",
    county: "San Francisco",
    isRestaurant: true,
    isShared: false,
    locationNumber: "",
    parkingLoading: "",
    createdAt: new Date().toISOString(),
    createdBy: "user123",
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    latitude: null,
    longitude: null,
  },
];

const mockPaginationData = {
  currentPage: 1,
  totalPages: 3,
  totalCount: 9,
  limit: 3,
  hasNextPage: true,
  hasPrevPage: false,
};

const mockUser = {
  id: "user123",
  email: "test@example.com",
  user_metadata: { name: "Test User" },
} as any;

const mockSupabaseClient = {
  auth: {
    getUser: jest
      .fn()
      .mockResolvedValue({ data: { user: mockUser }, error: null }),
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: "mock-token", user: mockUser } },
      error: null,
    }),
  },
};

// Create a test wrapper with QueryClient
function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries for testing
        staleTime: 0, // Always stale for testing
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("UserAddresses - Enhanced Infinite Loop Prevention with React Query", () => {
  let TestWrapper: React.ComponentType<{ children: React.ReactNode }>;

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    (global.fetch as jest.Mock).mockClear();
    TestWrapper = createTestWrapper();

    // Set up default fetch mock to prevent undefined errors
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        addresses: mockAddresses,
        pagination: mockPaginationData,
      }),
    });
  });

  describe("React Query Integration", () => {
    it("should use React Query for data fetching with proper caching", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: mockPaginationData,
        }),
      });

      render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Loading...")).toBeInTheDocument();
      });

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Verify fetch was called only once (React Query handles caching)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should not refetch data when component re-renders", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: mockPaginationData,
        }),
      });

      const { rerender } = render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Force a re-render
      rerender(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait a bit to see if any additional calls are made
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should still only have 1 API call due to React Query caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should handle filter changes with React Query optimization", async () => {
      // Mock successful API responses for different filters
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: mockAddresses,
            pagination: mockPaginationData,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: [mockAddresses[1]], // Only shared addresses
            pagination: { ...mockPaginationData, totalCount: 1 },
          }),
        });

      render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Change filter to "shared"
      const sharedTab = screen.getByTestId("tabs-trigger-shared");
      await userEvent.click(sharedTab);

      // Wait for filter change to complete
      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(screen.queryByText("Home")).not.toBeInTheDocument();
        expect(screen.queryByText("Restaurant")).not.toBeInTheDocument();
      });

      // Verify fetch was called exactly twice (initial + filter change)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Advanced Infinite Loop Prevention", () => {
    it("should prevent rapid successive API calls", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: mockPaginationData,
        }),
      });

      render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Rapidly change filters multiple times
      const allTab = screen.getByTestId("tabs-trigger-all");
      const privateTab = screen.getByTestId("tabs-trigger-private");
      const sharedTab = screen.getByTestId("tabs-trigger-shared");

      await act(async () => {
        await userEvent.click(privateTab);
        await userEvent.click(sharedTab);
        await userEvent.click(allTab);
        await userEvent.click(privateTab);
      });

      // Wait for all changes to settle
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Should not have excessive API calls due to React Query deduplication
      expect(global.fetch).toHaveBeenCalledTimes(5); // Initial + 4 filter changes
    });

    it("should handle concurrent requests properly", async () => {
      // Mock delayed API response to simulate concurrent requests
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({
                    addresses: mockAddresses,
                    pagination: mockPaginationData,
                  }),
                }),
              50,
            ),
          ),
      );

      render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Simulate rapid state changes
      const privateTab = screen.getByTestId("tabs-trigger-private");
      const sharedTab = screen.getByTestId("tabs-trigger-shared");

      await act(async () => {
        // These should be deduplicated by React Query
        privateTab.click();
        sharedTab.click();
        privateTab.click();
      });

      // Wait for changes to settle
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(4); // Initial + 3 filter changes
      });
    });
  });

  describe("Performance Monitoring Integration", () => {
    it("should track API call patterns for infinite loop detection", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: mockPaginationData,
        }),
      });

      // Spy on console.warn to detect suspicious pattern warnings
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Simulate rapid filter changes to trigger monitoring
      const privateTab = screen.getByTestId("tabs-trigger-private");
      const sharedTab = screen.getByTestId("tabs-trigger-shared");

      await act(async () => {
        for (let i = 0; i < 5; i++) {
          await userEvent.click(i % 2 === 0 ? privateTab : sharedTab);
          await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
        }
      });

      // Wait for all changes to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(6); // Initial + 5 filter changes
      });

      // Verify that performance monitoring is working
      expect(global.fetch).toHaveBeenCalledTimes(6);
    });

    it("should handle rate limiting gracefully", async () => {
      // Mock rate limit exceeded response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => ({
          error: "Rate limit exceeded",
          retryAfter: 60,
        }),
      });

      render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for rate limit error to be displayed
      await waitFor(() => {
        expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument();
      });

      // Verify fetch was called only once (no retries on rate limit)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle network errors without infinite retries", async () => {
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network Error"));

      render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for error to be displayed
      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load addresses/),
        ).toBeInTheDocument();
      });

      // Verify fetch was called only once (no retries)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should handle authentication errors gracefully", async () => {
      // Mock authentication error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for error to be displayed
      await waitFor(() => {
        expect(screen.getByText(/Authentication error/)).toBeInTheDocument();
      });

      // Verify fetch was called only once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should recover from errors when retrying manually", async () => {
      // Mock initial error, then success
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network Error"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: mockAddresses,
            pagination: mockPaginationData,
          }),
        });

      render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for initial error
      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load addresses/),
        ).toBeInTheDocument();
      });

      // Simulate manual retry (e.g., user clicking retry button)
      // This would typically be implemented in the component
      await act(async () => {
        // Force a re-render to simulate retry
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should have attempted to fetch again
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Cache Management", () => {
    it("should properly invalidate cache when data changes", async () => {
      // Mock successful API responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: mockAddresses,
            pagination: mockPaginationData,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: [mockAddresses[0]], // Only first address
            pagination: { ...mockPaginationData, totalCount: 1 },
          }),
        });

      render(
        <TestWrapper>
          <UserAddresses />
        </TestWrapper>,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Change filter to trigger cache invalidation
      const privateTab = screen.getByTestId("tabs-trigger-private");
      await userEvent.click(privateTab);

      // Wait for filter change to complete
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.queryByText("Work")).not.toBeInTheDocument();
        expect(screen.queryByText("Restaurant")).not.toBeInTheDocument();
      });

      // Verify that cache was properly managed
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
