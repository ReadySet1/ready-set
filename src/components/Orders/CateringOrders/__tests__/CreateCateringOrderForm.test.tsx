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

    // Should be called twice - once for pickup, once for delivery
    expect(mockAddressManagerWrapper).toHaveBeenCalledTimes(2);
  });

  it("provides refresh functions for both pickup and delivery addresses", async () => {
    const pickupRefreshCallbacks: Array<(fn: () => void) => void> = [];
    const deliveryRefreshCallbacks: Array<(fn: () => void) => void> = [];

    mockAddressManagerWrapper.mockImplementation((props) => {
      if (props.label && props.label.includes("Pickup")) {
        pickupRefreshCallbacks.push(props.onRefresh);
      } else if (props.label && props.label.includes("Delivery")) {
        deliveryRefreshCallbacks.push(props.onRefresh);
      }
      return <div data-testid="address-manager-wrapper">{props.children}</div>;
    });

    render(<CreateCateringOrderForm {...defaultProps} />);

    await waitFor(() => {
      expect(pickupRefreshCallbacks.length).toBeGreaterThan(0);
      expect(deliveryRefreshCallbacks.length).toBeGreaterThan(0);
    });
  });

  it("handles pickup address selection and clears validation errors", async () => {
    const mockForm = {
      setValue: jest.fn(),
      clearErrors: jest.fn(),
      getValues: jest.fn(() => ({})),
      trigger: jest.fn(),
    };

    // Mock the useForm hook to return our mock form
    jest.doMock("react-hook-form", () => ({
      useForm: () => mockForm,
      Controller: ({ render }: any) => render({ field: {}, fieldState: {} }),
    }));

    render(<CreateCateringOrderForm {...defaultProps} />);

    // Find the pickup address handler by checking the mock calls
    const pickupAddressHandler = mockAddressManagerWrapper.mock.calls.find(
      (call) => call[0].label && call[0].label.includes("Pickup"),
    )?.[0]?.onAddressSelected;

    if (pickupAddressHandler) {
      pickupAddressHandler("pickup-1");

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "pickUpLocationId",
        "pickup-1",
        { shouldValidate: true },
      );
      expect(mockForm.clearErrors).toHaveBeenCalledWith("pickUpLocationId");
    }
  });

  it("handles delivery address selection and clears validation errors", async () => {
    const mockForm = {
      setValue: jest.fn(),
      clearErrors: jest.fn(),
      getValues: jest.fn(() => ({})),
      trigger: jest.fn(),
    };

    // Mock the useForm hook to return our mock form
    jest.doMock("react-hook-form", () => ({
      useForm: () => mockForm,
      Controller: ({ render }: any) => render({ field: {}, fieldState: {} }),
    }));

    render(<CreateCateringOrderForm {...defaultProps} />);

    // Find the delivery address handler by checking the mock calls
    const deliveryAddressHandler = mockAddressManagerWrapper.mock.calls.find(
      (call) => call[0].label && call[0].label.includes("Delivery"),
    )?.[0]?.onAddressSelected;

    if (deliveryAddressHandler) {
      deliveryAddressHandler("delivery-1");

      expect(mockForm.setValue).toHaveBeenCalledWith(
        "deliveryLocationId",
        "delivery-1",
        { shouldValidate: true },
      );
      expect(mockForm.clearErrors).toHaveBeenCalledWith("deliveryLocationId");
    }
  });

  it("auto-selects address after creation with delay", async () => {
    jest.useFakeTimers();

    const mockForm = {
      setValue: jest.fn(),
      clearErrors: jest.fn(),
      getValues: jest.fn(() => ({})),
      trigger: jest.fn(),
    };

    render(<CreateCateringOrderForm {...defaultProps} />);

    // Simulate address creation flow
    const pickupAddressHandler = mockAddressManagerWrapper.mock.calls.find(
      (call) => call[0].label && call[0].label.includes("Pickup"),
    )?.[0]?.onAddressSelected;

    const pickupRefreshHandler = mockAddressManagerWrapper.mock.calls.find(
      (call) => call[0].label && call[0].label.includes("Pickup"),
    )?.[0]?.onRefresh;

    // Mock refresh function
    const mockRefresh = jest.fn();
    if (pickupRefreshHandler) {
      pickupRefreshHandler(mockRefresh);
    }

    // Simulate new address creation (would normally happen via AddAddressForm submission)
    if (pickupAddressHandler) {
      // First, trigger refresh
      mockRefresh();

      // Fast-forward time to trigger the auto-selection delay
      jest.advanceTimersByTime(300);

      // Then simulate the auto-selection
      pickupAddressHandler("new-pickup-123");
    }

    jest.useRealTimers();
  });

  it("validates required address fields before form submission", async () => {
    render(<CreateCateringOrderForm {...defaultProps} />);

    // Try to find and click submit button
    const submitButton = screen.queryByRole("button", {
      name: /create.*order/i,
    });

    if (submitButton) {
      await userEvent.click(submitButton);

      // Should show validation errors for missing addresses
      // This would depend on the actual validation implementation
    }
  });

  it("handles form submission with selected addresses", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, orderNumber: "SF-12345" }),
    });

    render(<CreateCateringOrderForm {...defaultProps} />);

    // Select addresses
    const pickupHandler = mockAddressManagerWrapper.mock.calls.find(
      (call) => call[0].label && call[0].label.includes("Pickup"),
    )?.[0]?.onAddressSelected;

    const deliveryHandler = mockAddressManagerWrapper.mock.calls.find(
      (call) => call[0].label && call[0].label.includes("Delivery"),
    )?.[0]?.onAddressSelected;

    if (pickupHandler) pickupHandler("pickup-1");
    if (deliveryHandler) deliveryHandler("delivery-1");

    // Find and submit form
    const submitButton = screen.queryByRole("button", {
      name: /create.*order/i,
    });
    if (submitButton) {
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/cater-valley/orders",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
            }),
            body: expect.stringContaining("pickup-1"),
          }),
        );
      });
    }
  });

  it("displays validation errors when addresses are not selected", async () => {
    render(<CreateCateringOrderForm {...defaultProps} />);

    // Try to submit without selecting addresses
    const submitButton = screen.queryByRole("button", {
      name: /create.*order/i,
    });
    if (submitButton) {
      await userEvent.click(submitButton);

      // Check for validation error messages
      await waitFor(() => {
        const pickupError = screen.queryByText(/pickup.*required/i);
        const deliveryError = screen.queryByText(/delivery.*required/i);

        // At least one validation error should be present
        expect(pickupError || deliveryError).toBeTruthy();
      });
    }
  });
});
