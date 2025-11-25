import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddressManager from "@/components/AddressManager";
import { createClient } from "@/utils/supabase/client";

// Mock Supabase client
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
    locationNumber: "4155551234",
    isRestaurant: false,
    isShared: false,
    parkingLoading: "",
    createdBy: "user1",
    createdAt: new Date("2025-07-10T20:05:23.466Z"),
    updatedAt: new Date("2025-07-10T20:05:23.466Z"),
  },
  {
    id: "2",
    name: "Office",
    street1: "456 Oak Ave",
    street2: "Suite 100",
    city: "San Mateo",
    state: "CA",
    zip: "94402",
    county: "San Mateo",
    locationNumber: "6505551234",
    isRestaurant: false,
    isShared: true,
    parkingLoading: "Parking garage",
    createdBy: "user2",
    createdAt: new Date("2025-07-10T20:05:23.466Z"),
    updatedAt: new Date("2025-07-10T20:05:23.466Z"),
  },
];

const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  data: mockAddresses,
  error: null,
  then: jest
    .fn()
    .mockImplementation((callback) =>
      callback({ data: mockAddresses, error: null }),
    ),
};

jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: "user1" },
            access_token: "test-token",
          },
        },
      }),
      onAuthStateChange: jest
        .fn()
        .mockReturnValue({ subscription: { unsubscribe: jest.fn() } }),
    },
    from: () => mockSupabaseClient,
  })),
}));

describe("AddressManager Component", () => {
  const mockOnAddressSelected = jest.fn();
  const mockOnAddressesLoaded = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the component with address selection", () => {
    render(
      <AddressManager
        onAddressSelected={mockOnAddressSelected}
        onAddressesLoaded={mockOnAddressesLoaded}
      />,
    );

    expect(screen.getByTestId("select-trigger")).toBeInTheDocument();
    expect(screen.getByText("Select an address")).toBeInTheDocument();
  });

  it("loads addresses on mount", async () => {
    render(
      <AddressManager
        onAddressSelected={mockOnAddressSelected}
        onAddressesLoaded={mockOnAddressesLoaded}
      />,
    );

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("addresses");
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith(mockAddresses);
    });
  });

  it("allows selecting an address", async () => {
    render(
      <AddressManager
        onAddressSelected={mockOnAddressSelected}
        onAddressesLoaded={mockOnAddressesLoaded}
      />,
    );

    // Click the select root to trigger value change
    const selectRoot = screen.getByTestId("select-root");
    await userEvent.click(selectRoot);

    expect(mockOnAddressSelected).toHaveBeenCalledWith("1");
  });

  it("shows the add address form when clicking the add button", async () => {
    render(
      <AddressManager
        onAddressSelected={mockOnAddressSelected}
        onAddressesLoaded={mockOnAddressesLoaded}
      />,
    );

    const addButton = screen.getByText("Add New Address");
    await userEvent.click(addButton);

    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
  });

  it("handles empty address list gracefully", async () => {
    // Mock empty address list
    mockSupabaseClient.then.mockImplementationOnce((callback) =>
      callback({ data: [], error: null }),
    );

    render(
      <AddressManager
        onAddressSelected={mockOnAddressSelected}
        onAddressesLoaded={mockOnAddressesLoaded}
      />,
    );

    await waitFor(() => {
      expect(mockOnAddressesLoaded).toHaveBeenCalledWith([]);
    });

    expect(screen.getByText("Select an address")).toBeInTheDocument();
  });
});
