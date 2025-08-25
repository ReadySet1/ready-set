import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  totalPages: 1,
  totalCount: 3,
  hasNextPage: false,
  hasPrevPage: false,
  limit: 5,
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

describe("UserAddresses - Infinite Loop Prevention", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    (global.fetch as jest.Mock).mockClear();

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

      render(<UserAddresses />);

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

      render(<UserAddresses />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Change filter to shared
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

    it("should not cause infinite API calls when pagination changes", async () => {
      const mockPaginationWithPages = {
        currentPage: 1,
        totalPages: 2,
        totalCount: 6,
        hasNextPage: true,
        hasPrevPage: false,
        limit: 3,
      };

      // Mock successful API responses for different pages
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: mockAddresses.slice(0, 3), // First 3 addresses
            pagination: mockPaginationWithPages,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: [mockAddresses[0]], // Next page with 1 address
            pagination: {
              ...mockPaginationWithPages,
              currentPage: 2,
              hasNextPage: false,
              hasPrevPage: true,
            },
          }),
        });

      render(<UserAddresses />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Go to next page
      const nextButton = screen.getByTestId("pagination-next");
      await userEvent.click(nextButton);

      // Wait for page change to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Verify fetch was called exactly twice (initial + page change)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle API errors without infinite retries", async () => {
      // Mock API error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      render(<UserAddresses />);

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

      render(<UserAddresses />);

      // Wait for error to be displayed
      await waitFor(() => {
        expect(screen.getByText(/Authentication error/)).toBeInTheDocument();
      });

      // Verify fetch was called only once
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

      render(<UserAddresses />);

      // Should show loading initially
      expect(screen.getByText("Loading...")).toBeInTheDocument();

      // Should hide loading after addresses load
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
    });

    it("should properly manage error states", async () => {
      // Mock API error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network Error"),
      );

      render(<UserAddresses />);

      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load addresses/),
        ).toBeInTheDocument();
      });

      // Should have dismiss button
      expect(screen.getByText("Dismiss")).toBeInTheDocument();
    });

    it("should clear error when dismissed", async () => {
      // Mock API error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network Error"),
      );

      render(<UserAddresses />);

      // Wait for error to appear
      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load addresses/),
        ).toBeInTheDocument();
      });

      // Click dismiss button
      const dismissButton = screen.getByText("Dismiss");
      await userEvent.click(dismissButton);

      // Error should be cleared
      expect(
        screen.queryByText(/Failed to load addresses/),
      ).not.toBeInTheDocument();
    });
  });

  describe("Filtering Functionality", () => {
    it("should display all addresses by default", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: mockPaginationData,
        }),
      });

      render(<UserAddresses />);

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Verify "All" tab is selected by default
      const allTab = screen.getByTestId("tabs-trigger-all");
      expect(allTab).toHaveAttribute("data-state", "active");
    });

    it("should filter to private addresses only", async () => {
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
            addresses: [mockAddresses[0], mockAddresses[2]], // Private addresses only
            pagination: { ...mockPaginationData, totalCount: 2 },
          }),
        });

      render(<UserAddresses />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Change to private filter
      const privateTab = screen.getByTestId("tabs-trigger-private");
      await userEvent.click(privateTab);

      // Verify only private addresses are shown
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.queryByText("Work")).not.toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });
    });

    it("should filter to shared addresses only", async () => {
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
            addresses: [mockAddresses[1]], // Shared addresses only
            pagination: { ...mockPaginationData, totalCount: 1 },
          }),
        });

      render(<UserAddresses />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Change to shared filter
      const sharedTab = screen.getByTestId("tabs-trigger-shared");
      await userEvent.click(sharedTab);

      // Verify only shared addresses are shown
      await waitFor(() => {
        expect(screen.queryByText("Home")).not.toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(screen.queryByText("Restaurant")).not.toBeInTheDocument();
      });
    });

    it("should reset pagination when filter changes", async () => {
      const mockPaginationWithPages = {
        currentPage: 2,
        totalPages: 2,
        totalCount: 6,
        hasNextPage: false,
        hasPrevPage: true,
        limit: 3,
      };

      // Mock successful API responses
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: [mockAddresses[0]], // Page 2
            pagination: mockPaginationWithPages,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: [mockAddresses[1]], // Filtered result
            pagination: {
              ...mockPaginationData,
              totalCount: 1,
              currentPage: 1,
            },
          }),
        });

      render(<UserAddresses />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Change filter
      const sharedTab = screen.getByTestId("tabs-trigger-shared");
      await userEvent.click(sharedTab);

      // Wait for filter change
      await waitFor(() => {
        expect(screen.getByText("Work")).toBeInTheDocument();
      });

      // Verify pagination was reset to page 1
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const secondCall = (global.fetch as jest.Mock).mock.calls[1][0];
      expect(secondCall).toContain("page=1");
    });
  });

  describe("Address Management", () => {
    it("should open add address modal when add button is clicked", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: mockPaginationData,
        }),
      });

      render(<UserAddresses />);

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Click add button
      const addButton = screen.getByText("+ Add New Address");
      await userEvent.click(addButton);

      // Modal should open
      expect(screen.getByTestId("address-modal")).toBeInTheDocument();
    });

    it("should open edit modal when edit button is clicked", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: mockPaginationData,
        }),
      });

      render(<UserAddresses />);

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Find and click edit button for first address
      const editButtons = screen.getAllByText("Edit");
      await userEvent.click(editButtons[0]);

      // Modal should open with address data
      expect(screen.getByTestId("address-modal")).toBeInTheDocument();
      expect(screen.getByText("Editing: Home")).toBeInTheDocument();
    });

    it("should show delete confirmation dialog when delete button is clicked", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: mockPaginationData,
        }),
      });

      render(<UserAddresses />);

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Find and click delete button for first address
      const deleteButtons = screen.getAllByText("Delete");
      await userEvent.click(deleteButtons[0]);

      // Delete confirmation should be shown
      const alertDialogs = screen.getAllByTestId("alert-dialog");
      expect(alertDialogs[0]).toBeInTheDocument();
    });
  });

  describe("Pagination Functionality", () => {
    it("should display pagination controls when there are multiple pages", async () => {
      const mockPaginationWithPages = {
        currentPage: 1,
        totalPages: 3,
        totalCount: 15,
        hasNextPage: true,
        hasPrevPage: false,
        limit: 5,
      };

      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: mockPaginationWithPages,
        }),
      });

      render(<UserAddresses />);

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
      });

      // Pagination controls should be visible
      expect(screen.getByTestId("pagination")).toBeInTheDocument();
      expect(screen.getByTestId("pagination-next")).toBeInTheDocument();
    });

    it("should handle page navigation correctly", async () => {
      const mockPaginationWithPages = {
        currentPage: 1,
        totalPages: 2,
        totalCount: 6,
        hasNextPage: true,
        hasPrevPage: false,
        limit: 3,
      };

      // Mock successful API responses for different pages
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: mockAddresses.slice(0, 3), // First 3 addresses
            pagination: mockPaginationWithPages,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            addresses: [mockAddresses[0]], // Next page with 1 address
            pagination: {
              ...mockPaginationWithPages,
              currentPage: 2,
              hasNextPage: false,
              hasPrevPage: true,
            },
          }),
        });

      render(<UserAddresses />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Go to next page
      const nextButton = screen.getByTestId("pagination-next");
      await userEvent.click(nextButton);

      // Wait for page change
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.queryByText("Work")).not.toBeInTheDocument();
        expect(screen.queryByText("Restaurant")).not.toBeInTheDocument();
      });
    });
  });

  describe("Data Format Handling", () => {
    it("should handle old array format from API", async () => {
      // Mock API response with old array format
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAddresses, // Old format - just array
      });

      render(<UserAddresses />);

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Verify fetch was called only once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should handle new paginated format from API", async () => {
      // Mock API response with new paginated format
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: mockPaginationData,
        }),
      });

      render(<UserAddresses />);

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText("Home")).toBeInTheDocument();
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(
          screen.getByText("Restaurant", { selector: "h3" }),
        ).toBeInTheDocument();
      });

      // Verify fetch was called only once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
