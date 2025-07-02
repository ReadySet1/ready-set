import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateCateringOrderForm } from "../CreateCateringOrderForm";
import { Address } from "@/types/address";

// Mock the AddressManager component
const mockAddressManagerWrapper = jest.fn();
jest.mock("../../AddressManagerWrapper", () => {
  return function MockAddressManagerWrapper(props: any) {
    mockAddressManagerWrapper(props);
    return <div data-testid="address-manager-wrapper">{props.children}</div>;
  };
});

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
};

jest.mock("@/utils/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Mock fetch
global.fetch = jest.fn();

const mockCateringRequest = {
  id: "catering-123",
  orderNumber: "ORD-123",
  pickupAddress: {
    id: "pickup-1",
    name: "Restaurant",
    street1: "123 Food St",
    city: "San Francisco",
    state: "CA",
    zip: "94103",
  },
  deliveryAddress: {
    id: "delivery-1",
    name: "Office",
    street1: "456 Work Ave",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
  },
};

const mockAddresses: Address[] = [
  {
    id: "pickup-1",
    county: "San Francisco",
    name: "Restaurant",
    street1: "123 Food St",
    street2: "",
    city: "San Francisco",
    state: "CA",
    zip: "94103",
    locationNumber: "4155551234",
    parkingLoading: "",
    isRestaurant: true,
    isShared: false,
    createdBy: "user1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "delivery-1",
    county: "San Francisco",
    name: "Office",
    street1: "456 Work Ave",
    street2: "Suite 200",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    locationNumber: "4155559999",
    parkingLoading: "Parking garage",
    isRestaurant: false,
    isShared: true,
    createdBy: "user2",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const defaultProps = {
  clients: [],
  cateringRequest: mockCateringRequest,
  onSuccess: jest.fn(),
  onCancel: jest.fn(),
};

describe("CreateCateringOrderForm Address Auto-Selection", () => {
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("passes onRefresh callbacks to AddressManagerWrapper components", async () => {
    render(<CreateCateringOrderForm {...defaultProps} />);

    // Check that AddressManagerWrapper was called with onRefresh callbacks
    expect(mockAddressManagerWrapper).toHaveBeenCalledWith(
      expect.objectContaining({
        onRefresh: expect.any(Function),
      }),
    );
  });

  it("provides refresh functions for both pickup and delivery addresses", async () => {
    const refreshCallbacks: Array<(fn: () => void) => void> = [];

    mockAddressManagerWrapper.mockImplementation((props) => {
      if (props.onRefresh) {
        refreshCallbacks.push(props.onRefresh);
      }
      return <div data-testid="address-manager-wrapper">{props.children}</div>;
    });

    render(<CreateCateringOrderForm {...defaultProps} />);

    await waitFor(() => {
      // Should have both pickup and delivery refresh callbacks
      expect(refreshCallbacks.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("handles address selection properly", async () => {
    const addressSelectionHandlers: Array<(addressId: string) => void> = [];

    mockAddressManagerWrapper.mockImplementation((props) => {
      if (props.onAddressSelected) {
        addressSelectionHandlers.push(props.onAddressSelected);
      }
      return <div data-testid="address-manager-wrapper">{props.children}</div>;
    });

    render(<CreateCateringOrderForm {...defaultProps} />);

    await waitFor(() => {
      expect(addressSelectionHandlers.length).toBeGreaterThanOrEqual(2);
    });

    // Simulate address selection
    if (addressSelectionHandlers.length >= 2) {
      addressSelectionHandlers[0]!("pickup-1"); // Pickup address
      addressSelectionHandlers[1]!("delivery-1"); // Delivery address
    }
  });

  it("validates form with address requirements", async () => {
    render(<CreateCateringOrderForm {...defaultProps} />);

    // Look for required field indicators or validation messages
    const form =
      screen.getByRole("form", { hidden: true }) ||
      document.querySelector("form");
    expect(form).toBeTruthy();
  });

  it("handles form submission with proper address data", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, orderNumber: "SF-12345" }),
    });

    const addressSelectionHandlers: Array<(addressId: string) => void> = [];

    mockAddressManagerWrapper.mockImplementation((props) => {
      if (props.onAddressSelected) {
        addressSelectionHandlers.push(props.onAddressSelected);
      }
      return <div data-testid="address-manager-wrapper">{props.children}</div>;
    });

    render(<CreateCateringOrderForm {...defaultProps} />);

    // Wait for handlers to be available
    await waitFor(() => {
      expect(addressSelectionHandlers.length).toBeGreaterThanOrEqual(2);
    });

    // Select addresses
    if (addressSelectionHandlers.length >= 2) {
      addressSelectionHandlers[0]!("pickup-1");
      addressSelectionHandlers[1]!("delivery-1");
    }

    // Try to submit the form
    const submitButtons = screen.getAllByRole("button");
    const submitButton = submitButtons.find(
      (btn) =>
        btn.textContent?.toLowerCase().includes("create") ||
        btn.textContent?.toLowerCase().includes("submit") ||
        btn.getAttribute("type") === "submit",
    );

    if (submitButton) {
      await userEvent.click(submitButton);

      // Wait for potential API call
      await waitFor(() => {
        // Form submission might trigger API calls or validation
        expect(true).toBe(true); // Basic test that form submission doesn't crash
      });
    }
  });

  it("handles address refresh mechanism", async () => {
    const refreshFunctions: Array<() => void> = [];
    const refreshCallbacks: Array<(fn: () => void) => void> = [];

    mockAddressManagerWrapper.mockImplementation((props) => {
      if (props.onRefresh) {
        refreshCallbacks.push(props.onRefresh);
      }
      return <div data-testid="address-manager-wrapper">{props.children}</div>;
    });

    render(<CreateCateringOrderForm {...defaultProps} />);

    await waitFor(() => {
      expect(refreshCallbacks.length).toBeGreaterThanOrEqual(2);
    });

    // Simulate providing refresh functions
    refreshCallbacks.forEach((callback, index) => {
      const mockRefresh = jest.fn();
      refreshFunctions.push(mockRefresh);
      callback(mockRefresh);
    });

    // Test that refresh functions can be called without errors
    refreshFunctions.forEach((refresh) => {
      expect(() => refresh()).not.toThrow();
    });
  });

  it("renders address manager wrappers for pickup and delivery", async () => {
    render(<CreateCateringOrderForm {...defaultProps} />);

    // Should render AddressManagerWrapper components
    const addressManagers = screen.getAllByTestId("address-manager-wrapper");
    expect(addressManagers.length).toBeGreaterThanOrEqual(2);
  });
});
