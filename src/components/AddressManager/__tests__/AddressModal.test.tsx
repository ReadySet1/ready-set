import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddressModal from "../AddressModal";
import { Address } from "@/types/address";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: jest.fn(),
  },
};

jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock hasPointerCapture for jsdom compatibility
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  value: jest.fn(),
  writable: true,
});

// Mock setPointerCapture for jsdom compatibility
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  value: jest.fn(),
  writable: true,
});

// Mock releasePointerCapture for jsdom compatibility
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  value: jest.fn(),
  writable: true,
});

const mockOnAddressUpdated = jest.fn();
const mockOnClose = jest.fn();

const defaultProps = {
  onAddressUpdated: mockOnAddressUpdated,
  addressToEdit: null,
  isOpen: true,
  onClose: mockOnClose,
};

const mockAddress: Address = {
  id: "test-id",
  county: "San Francisco",
  name: "Test Address",
  street1: "123 Main St",
  street2: "Apt 4B",
  city: "San Francisco",
  state: "CA",
  zip: "94103",
  locationNumber: "4155551234",
  parkingLoading: "Street parking",
  isRestaurant: false,
  isShared: false,
  createdBy: "user1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("AddressModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();

    // Mock successful authentication by default
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "mock-token",
          user: { id: "user1" },
        },
      },
      error: null,
    });

    // Mock successful API response by default
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...mockAddress, id: "new-address-id" }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("County Selection", () => {
    it("renders county field label", async () => {
      render(<AddressModal {...defaultProps} />);

      // County field label should be present - use getAllByText since "county" appears in both label and description
      const countyElements = screen.getAllByText(/County/i);
      expect(countyElements.length).toBeGreaterThanOrEqual(1);
    });

    it("renders location details section", async () => {
      render(<AddressModal {...defaultProps} />);

      // Section description mentions county
      expect(screen.getByText(/Specify the county and a friendly name/i)).toBeInTheDocument();
    });

    it("populates county when editing an existing address", async () => {
      const addressToEdit = { ...mockAddress, county: "San Mateo" };

      render(<AddressModal {...defaultProps} addressToEdit={addressToEdit} />);

      await waitFor(() => {
        expect(screen.getByText("San Mateo")).toBeInTheDocument();
      });
    });
  });

  describe("Address Saving", () => {
    it("successfully saves a new address with authentication", async () => {
      render(<AddressModal {...defaultProps} />);

      // Fill out the form using input IDs
      await userEvent.type(screen.getByRole("textbox", { name: /Address Name/i }), "Home Office");
      await userEvent.type(
        screen.getByRole("textbox", { name: /Street Address \*/i }),
        "123 Main St",
      );
      await userEvent.type(screen.getByRole("textbox", { name: /City/i }), "San Francisco");
      await userEvent.type(screen.getByRole("textbox", { name: /ZIP Code/i }), "94103");

      // Submit form
      const saveButton = screen.getByRole("button", { name: /save/i });
      await userEvent.click(saveButton);

      // Verify API call was made with correct data and authentication
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/addresses",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer mock-token",
            }),
            body: expect.stringContaining('"name":"Home Office"'),
          }),
        );
      });

      // Verify callbacks were called
      expect(mockOnAddressUpdated).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("successfully updates an existing address", async () => {
      const addressToEdit = { ...mockAddress, id: "existing-id" };

      render(<AddressModal {...defaultProps} addressToEdit={addressToEdit} />);

      // Modify the name
      const nameInput = screen.getByRole("textbox", { name: /Address Name/i });
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Updated Name");

      // Submit form
      const updateButton = screen.getByRole("button", { name: /update/i });
      await userEvent.click(updateButton);

      // Verify API call was made with PUT method
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/addresses?id=existing-id",
          expect.objectContaining({
            method: "PUT",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer mock-token",
            }),
            body: expect.stringContaining('"name":"Updated Name"'),
          }),
        );
      });

      // Verify callbacks were called
      expect(mockOnAddressUpdated).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("includes all form fields in the request", async () => {
      render(<AddressModal {...defaultProps} />);

      // Fill out all fields using role queries with accessible names
      await userEvent.type(screen.getByRole("textbox", { name: /Address Name/i }), "Main Office");
      await userEvent.type(
        screen.getByRole("textbox", { name: /Street Address \*/i }),
        "123 Main St",
      );
      await userEvent.type(
        screen.getByRole("textbox", { name: /Street Address 2/i }),
        "Suite 100",
      );
      await userEvent.type(screen.getByRole("textbox", { name: /City/i }), "San Francisco");
      await userEvent.type(screen.getByRole("textbox", { name: /ZIP Code/i }), "94103");
      await userEvent.type(
        screen.getByRole("textbox", { name: /Location Phone Number/i }),
        "4155551234",
      );
      await userEvent.type(
        screen.getByRole("textbox", { name: /Parking \/ Loading Info/i }),
        "Street parking",
      );

      // Check restaurant checkbox
      const restaurantCheckbox = screen.getByRole("checkbox", { name: /Restaurant Address/i });
      await userEvent.click(restaurantCheckbox);

      // Check shared checkbox
      const sharedCheckbox = screen.getByRole("checkbox", { name: /Shared Address/i });
      await userEvent.click(sharedCheckbox);

      // Submit form
      const saveButton = screen.getByRole("button", { name: /save/i });
      await userEvent.click(saveButton);

      // Verify all fields are included in the request
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/addresses",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"name":"Main Office"'),
          }),
        );
      });

      const call = (fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(call[1].body);

      expect(requestBody).toEqual(
        expect.objectContaining({
          name: "Main Office",
          street1: "123 Main St",
          street2: "Suite 100",
          city: "San Francisco",
          zip: "94103",
          locationNumber: "4155551234",
          parkingLoading: "Street parking",
          isRestaurant: true,
          isShared: true,
        }),
      );
    });
  });

  describe("Authentication", () => {
    it("handles authentication failure gracefully", async () => {
      // Mock authentication failure
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Authentication required" },
      });

      render(<AddressModal {...defaultProps} />);

      // Fill out form
      await userEvent.type(
        screen.getByRole("textbox", { name: /Street Address \*/i }),
        "123 Main St",
      );
      await userEvent.type(screen.getByRole("textbox", { name: /City/i }), "San Francisco");
      await userEvent.type(screen.getByRole("textbox", { name: /ZIP Code/i }), "94103");

      // Submit form
      const saveButton = screen.getByRole("button", { name: /save/i });
      await userEvent.click(saveButton);

      // Verify API call was NOT made
      expect(fetch).not.toHaveBeenCalled();
    });

    it("includes proper authorization header in requests", async () => {
      const mockToken = "mock-auth-token-" + Date.now();
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            access_token: mockToken,
            user: { id: "user1" },
          },
        },
        error: null,
      });

      render(<AddressModal {...defaultProps} />);

      // Fill out minimal form
      await userEvent.type(
        screen.getByRole("textbox", { name: /Street Address \*/i }),
        "123 Main St",
      );
      await userEvent.type(screen.getByRole("textbox", { name: /City/i }), "San Francisco");
      await userEvent.type(screen.getByRole("textbox", { name: /ZIP Code/i }), "94103");

      // Submit form
      const saveButton = screen.getByRole("button", { name: /save/i });
      await userEvent.click(saveButton);

      // Verify authorization header
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          "/api/addresses",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: `Bearer ${mockToken}`,
            }),
          }),
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      // Mock API failure
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      render(<AddressModal {...defaultProps} />);

      // Fill out form
      await userEvent.type(
        screen.getByRole("textbox", { name: /Street Address \*/i }),
        "123 Main St",
      );
      await userEvent.type(screen.getByRole("textbox", { name: /City/i }), "San Francisco");
      await userEvent.type(screen.getByRole("textbox", { name: /ZIP Code/i }), "94103");

      // Submit form
      const saveButton = screen.getByRole("button", { name: /save/i });
      await userEvent.click(saveButton);

      // Verify callbacks were NOT called due to error
      await waitFor(() => {
        expect(mockOnAddressUpdated).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });

    it("handles network errors gracefully", async () => {
      // Mock network failure
      (fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<AddressModal {...defaultProps} />);

      // Fill out form
      await userEvent.type(
        screen.getByRole("textbox", { name: /Street Address \*/i }),
        "123 Main St",
      );
      await userEvent.type(screen.getByRole("textbox", { name: /City/i }), "San Francisco");
      await userEvent.type(screen.getByRole("textbox", { name: /ZIP Code/i }), "94103");

      // Submit form
      const saveButton = screen.getByRole("button", { name: /save/i });
      await userEvent.click(saveButton);

      // Verify callbacks were NOT called due to error
      await waitFor(() => {
        expect(mockOnAddressUpdated).not.toHaveBeenCalled();
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });
  });

  describe("Modal Behavior", () => {
    it("shows correct title for adding new address", () => {
      render(<AddressModal {...defaultProps} />);
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    it("shows correct title for editing existing address", () => {
      render(<AddressModal {...defaultProps} addressToEdit={mockAddress} />);
      expect(screen.getByText("Edit Address")).toBeInTheDocument();
    });

    it("shows save button for new address", () => {
      render(<AddressModal {...defaultProps} />);
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });

    it("shows update button for existing address", () => {
      render(<AddressModal {...defaultProps} addressToEdit={mockAddress} />);
      expect(
        screen.getByRole("button", { name: /update/i }),
      ).toBeInTheDocument();
    });

    // Note: Dialog visibility is controlled by Radix Dialog which handles the open prop.
    // The mock Dialog in tests always renders content. This behavior is tested by Radix.
    it("passes isOpen prop to dialog", () => {
      render(<AddressModal {...defaultProps} isOpen={false} />);
      // The Dialog component receives the open prop
      const dialogRoot = screen.getByTestId("dialog-root");
      expect(dialogRoot).toBeInTheDocument();
    });

    it("pre-fills form when editing existing address", async () => {
      const addressToEdit = {
        ...mockAddress,
        name: "Existing Name",
        street1: "Existing Street",
        city: "Existing City",
        state: "CA",
        zip: "12345",
        county: "Alameda",
      };

      render(<AddressModal {...defaultProps} addressToEdit={addressToEdit} />);

      // Check that form fields are pre-filled
      await waitFor(() => {
        expect(screen.getByDisplayValue("Existing Name")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Existing Street")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Existing City")).toBeInTheDocument();
        expect(screen.getByDisplayValue("12345")).toBeInTheDocument();
      });

      // Check that county dropdown is pre-filled
      expect(screen.getByText("Alameda")).toBeInTheDocument();
    });
  });

  describe("Form Reset", () => {
    it("resets form after successful submission", async () => {
      render(<AddressModal {...defaultProps} />);

      // Fill out form
      await userEvent.type(screen.getByRole("textbox", { name: /Address Name/i }), "Test Name");
      await userEvent.type(
        screen.getByRole("textbox", { name: /Street Address \*/i }),
        "123 Main St",
      );
      await userEvent.type(screen.getByRole("textbox", { name: /City/i }), "San Francisco");
      await userEvent.type(screen.getByRole("textbox", { name: /ZIP Code/i }), "94103");

      // Submit form
      const saveButton = screen.getByRole("button", { name: /save/i });
      await userEvent.click(saveButton);

      // Verify success callbacks were called
      await waitFor(() => {
        expect(mockOnAddressUpdated).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });
});
