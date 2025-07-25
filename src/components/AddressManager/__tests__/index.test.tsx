import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddressManager from "../index";
import { Address } from "@/types/address";
import { render } from "@/__tests__/utils/test-utils";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
};

jest.mock("@/utils/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Mock fetch
global.fetch = jest.fn();

const mockAddresses: Address[] = [
  {
    id: "1",
    county: "San Francisco",
    name: "Home",
    street1: "123 Main St",
    street2: "",
    city: "San Francisco",
    state: "CA",
    zip: "94103",
    locationNumber: "4155551234",
    parkingLoading: "",
    isRestaurant: false,
    isShared: false,
    createdBy: "user1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    county: "San Mateo",
    name: "Office",
    street1: "456 Oak Ave",
    street2: "Suite 100",
    city: "San Mateo",
    state: "CA",
    zip: "94402",
    locationNumber: "6505551234",
    parkingLoading: "Parking garage",
    isRestaurant: false,
    isShared: true,
    createdBy: "user2",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockOnAddressSelected = jest.fn();
const mockOnAddressesLoaded = jest.fn();
const mockOnError = jest.fn();
const mockOnRefresh = jest.fn();

const defaultProps = {
  onAddressSelected: mockOnAddressSelected,
  onAddressesLoaded: mockOnAddressesLoaded,
  onError: mockOnError,
  onRefresh: mockOnRefresh,
};

describe("AddressManager Refresh Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();

    // Mock successful auth
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user1" } },
      error: null,
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "mock-token", user: { id: "user1" } } },
      error: null,
    });

    // Mock successful address fetch
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAddresses),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls onRefresh with refresh function when provided", async () => {
    render(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  it("loads addresses on mount and calls onAddressesLoaded", async () => {
    render(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/addresses?filter=all",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
    });
  });

  it("refreshes addresses when refresh function is called", async () => {
    const capturedRefreshFunctions: Array<() => void> = [];

    const captureRefreshFunction = (fn: () => void) => {
      capturedRefreshFunctions.push(fn);
    };

    render(
      <AddressManager {...defaultProps} onRefresh={captureRefreshFunction} />,
    );

    // Wait for initial load
    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
    });

    // Clear previous calls
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();

    // Mock new address data for refresh
    const newMockAddresses: Address[] = [
      ...mockAddresses,
      {
        id: "3",
        county: "Santa Clara",
        name: "New Address",
        street1: "789 Pine St",
        street2: "",
        city: "Palo Alto",
        state: "CA",
        zip: "94301",
        locationNumber: "6505559999",
        parkingLoading: "",
        isRestaurant: false,
        isShared: false,
        createdBy: "user1",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(newMockAddresses),
    });

    // Call refresh function
    expect(capturedRefreshFunctions.length).toBeGreaterThan(0);
    if (capturedRefreshFunctions.length > 0) {
      capturedRefreshFunctions[0]!();
    }

    // Verify addresses are refetched
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/addresses?filter=all",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith(newMockAddresses);
    });
  });

  it("resets fetch attempts when refresh is called manually", async () => {
    const capturedRefreshFunctions: Array<() => void> = [];

    const captureRefreshFunction = (fn: () => void) => {
      capturedRefreshFunctions.push(fn);
    };

    // First, simulate multiple failed attempts
    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAddresses),
      });

    render(
      <AddressManager {...defaultProps} onRefresh={captureRefreshFunction} />,
    );

    // Wait for refresh function to be available
    await waitFor(() => {
      expect(capturedRefreshFunctions.length).toBeGreaterThan(0);
    });

    // Now call refresh - it should reset attempts and succeed
    if (capturedRefreshFunctions.length > 0) {
      capturedRefreshFunctions[0]!();
    }

    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
    });
  });

  it("handles authentication errors properly", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Unauthorized" },
    });

    render(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        "Authentication required to load addresses.",
      );
    });
  });

  it("handles API fetch errors properly", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    render(<AddressManager {...defaultProps} />);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        "Error fetching addresses: Internal Server Error",
      );
    });
  });
});
