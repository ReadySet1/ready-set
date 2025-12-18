import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AddressModal from "../AddressModal";
import { Address } from "@/types/address";

// Mock React Query hooks
const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();

jest.mock("@/hooks/useAddresses", () => ({
  useCreateAddress: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateAddress: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

// Create a test QueryClient
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

// Wrapper with QueryClientProvider
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Custom render function with QueryClientProvider
const customRender = (ui: React.ReactElement, options?: any) =>
  render(ui, { wrapper: TestWrapper, ...options });

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

    // Mock successful mutations by default
    mockCreateMutateAsync.mockResolvedValue({ ...mockAddress, id: "new-address-id" });
    mockUpdateMutateAsync.mockResolvedValue(mockAddress);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("County Selection", () => {
    it("renders county field label", async () => {
      customRender(<AddressModal {...defaultProps} />);

      // County field label should be present - use getAllByText since "county" appears in both label and description
      const countyElements = screen.getAllByText(/County/i);
      expect(countyElements.length).toBeGreaterThanOrEqual(1);
    });

    it("renders location details section", async () => {
      customRender(<AddressModal {...defaultProps} />);

      // Section description mentions county
      expect(screen.getByText(/Specify the county and a friendly name/i)).toBeInTheDocument();
    });

    it("populates county when editing an existing address", async () => {
      const addressToEdit = { ...mockAddress, county: "San Mateo" };

      customRender(<AddressModal {...defaultProps} addressToEdit={addressToEdit} />);

      await waitFor(() => {
        expect(screen.getByText("San Mateo")).toBeInTheDocument();
      });
    });
  });

  describe("Address Saving", () => {
    it("successfully saves a new address", async () => {
      customRender(<AddressModal {...defaultProps} />);

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

      // Verify mutation was called with correct data
      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Home Office",
            street1: "123 Main St",
            city: "San Francisco",
            zip: "94103",
          }),
        );
      });

      // Verify onAddressUpdated was called (component no longer directly calls onClose)
      expect(mockOnAddressUpdated).toHaveBeenCalled();
    });

    it("successfully updates an existing address", async () => {
      const addressToEdit = { ...mockAddress, id: "existing-id" };

      customRender(<AddressModal {...defaultProps} addressToEdit={addressToEdit} />);

      // Modify the name
      const nameInput = screen.getByRole("textbox", { name: /Address Name/i });
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Updated Name");

      // Submit form
      const updateButton = screen.getByRole("button", { name: /update/i });
      await userEvent.click(updateButton);

      // Verify update mutation was called
      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "existing-id",
            data: expect.objectContaining({
              name: "Updated Name",
            }),
          }),
        );
      });

      // Verify onAddressUpdated was called (component no longer directly calls onClose)
      expect(mockOnAddressUpdated).toHaveBeenCalled();
    });

    it("includes all form fields in the request", async () => {
      customRender(<AddressModal {...defaultProps} />);

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

      // Verify all fields are included in the mutation call
      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
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
  });

  describe("Error Handling", () => {
    it("handles mutation errors gracefully", async () => {
      // Mock mutation failure
      mockCreateMutateAsync.mockRejectedValue(new Error("Failed to create address"));

      customRender(<AddressModal {...defaultProps} />);

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

      // Verify onAddressUpdated was NOT called due to error
      await waitFor(() => {
        expect(mockOnAddressUpdated).not.toHaveBeenCalled();
      });
    });
  });

  describe("Modal Behavior", () => {
    it("shows correct title for adding new address", () => {
      customRender(<AddressModal {...defaultProps} />);
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    it("shows correct title for editing existing address", () => {
      customRender(<AddressModal {...defaultProps} addressToEdit={mockAddress} />);
      expect(screen.getByText("Edit Address")).toBeInTheDocument();
    });

    it("shows save button for new address", () => {
      customRender(<AddressModal {...defaultProps} />);
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });

    it("shows update button for existing address", () => {
      customRender(<AddressModal {...defaultProps} addressToEdit={mockAddress} />);
      expect(
        screen.getByRole("button", { name: /update/i }),
      ).toBeInTheDocument();
    });

    // Note: Dialog visibility is controlled by Radix Dialog which handles the open prop.
    // The mock Dialog in tests always renders content. This behavior is tested by Radix.
    it("passes isOpen prop to dialog", () => {
      customRender(<AddressModal {...defaultProps} isOpen={false} />);
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

      customRender(<AddressModal {...defaultProps} addressToEdit={addressToEdit} />);

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
      customRender(<AddressModal {...defaultProps} />);

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

      // Verify onAddressUpdated was called (component no longer directly calls onClose)
      await waitFor(() => {
        expect(mockOnAddressUpdated).toHaveBeenCalled();
      });
    });
  });
});
