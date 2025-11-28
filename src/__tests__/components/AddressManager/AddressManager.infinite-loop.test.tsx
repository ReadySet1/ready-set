import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddressManager from "@/components/AddressManager";
import { createClient } from "@/utils/supabase/client";

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock the entire select component module
jest.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
  }) => (
    <div
      data-testid="select-root"
      onClick={() => onValueChange && onValueChange("1")}
    >
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="select-trigger">{children}</button>
  ),
  SelectValue: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="select-value">{children}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => (
    <div data-testid={`select-item-${value}`} onClick={() => {}}>
      {children}
    </div>
  ),
  SelectLabel: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="select-label">{children}</span>
  ),
  SelectGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-group">{children}</div>
  ),
}));

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

// Mock the dialog component module
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (value: boolean) => void;
  }) => (
    <div
      data-testid="dialog-root"
      data-open={open}
      onClick={() => onOpenChange && onOpenChange(false)}
    >
      {children}
    </div>
  ),
  DialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="dialog-trigger">{children}</button>
  ),
  DialogPortal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-portal">{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogClose: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="dialog-close">{children}</button>
  ),
}));

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
];

const mockPaginationData = {
  currentPage: 1,
  totalPages: 1,
  totalCount: 2,
  hasNextPage: false,
  hasPrevPage: false,
  limit: 5,
};

const mockUser = {
  id: "user123",
  email: "test@example.com",
  user_metadata: { name: "Test User", role: "client" },
} as any;

// Helper to create a chainable query builder mock
const createMockQueryBuilder = (returnData: any = null) => {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: returnData, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: returnData, error: null }),
  };
  return builder;
};

const mockSupabaseClient = {
  auth: {
    getUser: jest
      .fn()
      .mockResolvedValue({ data: { user: mockUser }, error: null }),
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: "mock-token", user: mockUser } },
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

/**
 * TODO: REA-211 - This is a duplicate test file
 * The canonical AddressManager tests are in src/components/AddressManager/__tests__/
 */
describe.skip("AddressManager - Infinite Loop Prevention", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    (global.fetch as jest.Mock).mockClear();
  });

  describe("Infinite Loop Prevention", () => {
    it("should not cause infinite API calls when component mounts", async () => {
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
        <AddressManager
          onAddressSelected={jest.fn()}
          onAddressesLoaded={jest.fn()}
          onError={jest.fn()}
        />,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Loading addresses...")).toBeInTheDocument();
      });

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText(/Home - 123 Main St/)).toBeInTheDocument();
        expect(screen.getByText(/Work - 456 Business Ave/)).toBeInTheDocument();
      });

      // Verify fetch was called only once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should not cause infinite API calls when filter changes", async () => {
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
        <AddressManager
          onAddressSelected={jest.fn()}
          onAddressesLoaded={jest.fn()}
          onError={jest.fn()}
        />,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText(/Home - 123 Main St/)).toBeInTheDocument();
      });

      // Change filter to shared
      const sharedTab = screen.getByTestId("tabs-trigger-shared");
      await userEvent.click(sharedTab);

      // Wait for filter change to complete - the component will refetch but may still show all addresses
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Verify the second API call was made with the shared filter
      const secondCall = (global.fetch as jest.Mock).mock.calls[1][0];
      expect(secondCall).toContain("filter=shared");

      // Verify fetch was called exactly twice (initial + filter change)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle API errors without infinite retries", async () => {
      const onError = jest.fn();

      // Mock API error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      render(
        <AddressManager
          onAddressSelected={jest.fn()}
          onAddressesLoaded={jest.fn()}
          onError={onError}
        />,
      );

      // Wait for error to be handled via callback
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.stringMatching(/Error fetching addresses/),
        );
      });

      // Verify fetch was called only once (no retries)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should respect MAX_FETCH_ATTEMPTS limit", async () => {
      const onError = jest.fn();

      // Mock API errors multiple times
      (global.fetch as jest.Mock).mockRejectedValue(new Error("API Error"));

      render(
        <AddressManager
          onAddressSelected={jest.fn()}
          onAddressesLoaded={jest.fn()}
          onError={onError}
        />,
      );

      // Wait for error to be handled via callback
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.stringMatching(/Error fetching addresses/),
        );
      });

      // Verify fetch was called only once (no retries)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("State Management", () => {
    it("should properly manage loading states", async () => {
      // Mock delayed API response
      (global.fetch as jest.Mock).mockImplementationOnce(
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
              100,
            ),
          ),
      );

      render(
        <AddressManager
          onAddressSelected={jest.fn()}
          onAddressesLoaded={jest.fn()}
          onError={jest.fn()}
        />,
      );

      // Should show loading initially
      expect(screen.getByText("Loading addresses...")).toBeInTheDocument();

      // Should hide loading after addresses load
      await waitFor(() => {
        expect(
          screen.queryByText("Loading addresses..."),
        ).not.toBeInTheDocument();
      });
    });

    it("should properly manage error states", async () => {
      const onError = jest.fn();

      // Mock API error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network Error"),
      );

      render(
        <AddressManager
          onAddressSelected={jest.fn()}
          onAddressesLoaded={jest.fn()}
          onError={onError}
        />,
      );

      // Should handle error via callback
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.stringMatching(/Error fetching addresses/),
        );
      });
    });
  });

  describe("Callback Functions", () => {
    it("should call onAddressesLoaded when addresses are fetched", async () => {
      const onAddressesLoaded = jest.fn();

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
        <AddressManager
          onAddressSelected={jest.fn()}
          onAddressesLoaded={onAddressesLoaded}
          onError={jest.fn()}
        />,
      );

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText(/Home - 123 Main St/)).toBeInTheDocument();
      });

      // Verify callback was called with correct data
      expect(onAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
    });

    it("should call onError when API fails", async () => {
      const onError = jest.fn();

      // Mock API error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      render(
        <AddressManager
          onAddressSelected={jest.fn()}
          onAddressesLoaded={jest.fn()}
          onError={onError}
        />,
      );

      // Wait for error to be handled
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.stringMatching(/Error fetching addresses/),
        );
      });
    });

    it("should call onRefresh when refresh function is provided", async () => {
      const onRefresh = jest.fn();

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
        <AddressManager
          onAddressSelected={jest.fn()}
          onAddressesLoaded={jest.fn()}
          onError={jest.fn()}
          onRefresh={onRefresh}
        />,
      );

      // Wait for component to mount
      await waitFor(() => {
        expect(onRefresh).toHaveBeenCalled();
      });

      // Verify the refresh function was provided
      const refreshFunction = onRefresh.mock.calls[0][0];
      expect(typeof refreshFunction).toBe("function");
    });
  });
});
