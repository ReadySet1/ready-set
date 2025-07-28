import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import AddressManager from "../index";
import { Address } from "@/types/address";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
  success: jest.fn(),
  error: jest.fn(),
}));

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: "test-user-id", email: "test@example.com" },
          },
        },
        error: null,
      }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          then: jest.fn((callback) => {
            // Mock successful response with test addresses
            callback({
              data: [
                {
                  id: "1",
                  street1: "123 Test St",
                  street2: null,
                  city: "Test City",
                  state: "TS",
                  zip: "12345",
                  county: null,
                  locationNumber: null,
                  parkingLoading: null,
                  name: "Test Address 1",
                  isRestaurant: false,
                  isShared: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  createdBy: "test-user-id",
                },
                {
                  id: "2",
                  street1: "456 Private St",
                  street2: null,
                  city: "Private City",
                  state: "TS",
                  zip: "54321",
                  county: null,
                  locationNumber: null,
                  parkingLoading: null,
                  name: "Private Address",
                  isRestaurant: false,
                  isShared: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  createdBy: "test-user-id",
                },
              ],
              error: null,
            });
          }),
        })),
      })),
    })),
  })),
}));

// Mock UI components to avoid displayName issues
jest.mock("@/components/ui/select", () => ({
  Select: ({ children, ...props }: any) => (
    <div data-testid="select" {...props}>
      {children}
    </div>
  ),
  SelectContent: ({ children, ...props }: any) => (
    <div data-testid="select-content" {...props}>
      {children}
    </div>
  ),
  SelectItem: ({ children, ...props }: any) => (
    <div data-testid="select-item" {...props}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <div data-testid="select-trigger" {...props}>
      {children}
    </div>
  ),
  SelectValue: ({ children, ...props }: any) => (
    <div data-testid="select-value" {...props}>
      {children}
    </div>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button data-testid="button" {...props}>
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/input", () => ({
  Input: ({ ...props }: any) => <input data-testid="input" {...props} />,
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, ...props }: any) => (
    <div data-testid="card-title" {...props}>
      {children}
    </div>
  ),
}));

describe("AddressManager Component", () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
  };

  const mockAddresses: Address[] = [
    {
      id: "1",
      street1: "123 Test St",
      street2: null,
      city: "Test City",
      state: "TS",
      zip: "12345",
      county: null,
      locationNumber: null,
      parkingLoading: null,
      name: "Test Address 1",
      isRestaurant: false,
      isShared: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "test-user-id",
    },
    {
      id: "2",
      street1: "456 Private St",
      street2: null,
      city: "Private City",
      state: "TS",
      zip: "54321",
      county: null,
      locationNumber: null,
      parkingLoading: null,
      name: "Private Address",
      isRestaurant: false,
      isShared: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "test-user-id",
    },
  ];

  const mockOnAddressesLoaded = jest.fn();
  const mockOnAddressSelected = jest.fn();

  beforeAll(() => {
    // Suppress console.log during tests
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    mockOnAddressesLoaded.mockClear();
    mockOnAddressSelected.mockClear();
  });

  describe("Component Rendering", () => {
    it("should render the address manager with title", async () => {
      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      expect(screen.getByText("Address Manager")).toBeInTheDocument();
      expect(screen.getByText("Select an address")).toBeInTheDocument();
    });

    it("should render filter options", async () => {
      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      expect(screen.getByText("Filter by:")).toBeInTheDocument();
      expect(screen.getByText("All Addresses")).toBeInTheDocument();
      expect(screen.getByText("Shared Addresses")).toBeInTheDocument();
      expect(screen.getByText("Private Addresses")).toBeInTheDocument();
    });
  });

  describe("Address Loading", () => {
    it("should load addresses on component mount", async () => {
      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      await waitFor(() => {
        expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
      });
    });

    it("should handle loading state", async () => {
      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      // Initially should show loading state
      expect(screen.getByText("Loading addresses...")).toBeInTheDocument();
    });

    it("should handle empty address list", async () => {
      // Mock empty response
      const { createClient } = require("@/utils/supabase/client");
      createClient.mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: "test-user-id", email: "test@example.com" },
              },
            },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              then: jest.fn((callback) => {
                callback({
                  data: [],
                  error: null,
                });
              }),
            })),
          })),
        })),
      });

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      await waitFor(() => {
        expect(mockOnAddressesLoaded).toHaveBeenCalledWith([]);
      });

      expect(screen.getByText("No addresses found")).toBeInTheDocument();
    });
  });

  describe("Address Filtering", () => {
    it("should filter addresses by shared status", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      // Wait for addresses to load
      await waitFor(() => {
        expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
      });

      // Click on shared addresses filter
      const sharedFilter = screen.getByText("Shared Addresses");
      await act(async () => {
        await user.click(sharedFilter);
      });

      // Should show only shared addresses
      expect(screen.getByText("123 Test St")).toBeInTheDocument();
      expect(screen.queryByText("456 Private St")).not.toBeInTheDocument();
    });

    it("should filter addresses by private status", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      // Wait for addresses to load
      await waitFor(() => {
        expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
      });

      // Click on private addresses filter
      const privateFilter = screen.getByText("Private Addresses");
      await act(async () => {
        await user.click(privateFilter);
      });

      // Should show only private addresses
      expect(screen.getByText("456 Private St")).toBeInTheDocument();
      expect(screen.queryByText("123 Test St")).not.toBeInTheDocument();
    });

    it("should show all addresses when 'All Addresses' is selected", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      // Wait for addresses to load
      await waitFor(() => {
        expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
      });

      // Click on all addresses filter
      const allFilter = screen.getByText("All Addresses");
      await act(async () => {
        await user.click(allFilter);
      });

      // Should show all addresses
      expect(screen.getByText("123 Test St")).toBeInTheDocument();
      expect(screen.getByText("456 Private St")).toBeInTheDocument();
    });
  });

  describe("Address Selection", () => {
    it("should call onAddressSelected when an address is clicked", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      // Wait for addresses to load
      await waitFor(() => {
        expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
      });

      // Click on an address
      const addressItem = screen.getByText("123 Test St");
      await act(async () => {
        await user.click(addressItem);
      });

      expect(mockOnAddressSelected).toHaveBeenCalledWith("1");
    });

    it("should highlight selected address", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      // Wait for addresses to load
      await waitFor(() => {
        expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
      });

      // Click on an address
      const addressItem = screen.getByText("123 Test St");
      await act(async () => {
        await user.click(addressItem);
      });

      // The selected address should have a different style
      expect(addressItem).toHaveClass("selected");
    });
  });

  describe("Search Functionality", () => {
    it("should filter addresses by search term", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      // Wait for addresses to load
      await waitFor(() => {
        expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
      });

      // Type in search box
      const searchInput = screen.getByPlaceholderText("Search addresses...");
      await act(async () => {
        await user.type(searchInput, "Test");
      });

      // Should show only addresses matching "Test"
      expect(screen.getByText("123 Test St")).toBeInTheDocument();
      expect(screen.queryByText("456 Private St")).not.toBeInTheDocument();
    });

    it("should clear search results when search is cleared", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      // Wait for addresses to load
      await waitFor(() => {
        expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
      });

      // Type in search box
      const searchInput = screen.getByPlaceholderText("Search addresses...");
      await act(async () => {
        await user.type(searchInput, "Test");
      });

      // Clear search
      await act(async () => {
        await user.clear(searchInput);
      });

      // Should show all addresses again
      expect(screen.getByText("123 Test St")).toBeInTheDocument();
      expect(screen.getByText("456 Private St")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should navigate to add address page when add button is clicked", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      // Click add address button
      const addButton = screen.getByText("Add Address");
      await act(async () => {
        await user.click(addButton);
      });

      expect(mockPush).toHaveBeenCalledWith("/addresses/add");
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      // Mock authentication error
      const { createClient } = require("@/utils/supabase/client");
      createClient.mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: { message: "Authentication failed" },
          }),
        },
      });

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      expect(screen.getByText("Authentication required")).toBeInTheDocument();
    });

    it("should handle database errors", async () => {
      // Mock database error
      const { createClient } = require("@/utils/supabase/client");
      createClient.mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: "test-user-id", email: "test@example.com" },
              },
            },
            error: null,
          }),
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              then: jest.fn((callback) => {
                callback({
                  data: null,
                  error: { message: "Database connection failed" },
                });
              }),
            })),
          })),
        })),
      });

      await act(async () => {
        render(
          <AddressManager
            onAddressesLoaded={mockOnAddressesLoaded}
            onAddressSelected={mockOnAddressSelected}
          />,
        );
      });

      expect(screen.getByText("Failed to load addresses")).toBeInTheDocument();
    });
  });
});
