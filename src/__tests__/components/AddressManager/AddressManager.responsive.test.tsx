import React from "react";
import { render, screen } from "@testing-library/react";
import AddressManager from "@/components/AddressManager";
import { Address } from "@/types/address";

// Mock the createClient function
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => {
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

    return {
      auth: {
        getUser: jest.fn(() =>
          Promise.resolve({
            data: { user: { id: "test-user", user_metadata: { role: "client" } } },
            error: null,
          }),
        ),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
        getSession: jest.fn(() =>
          Promise.resolve({
            data: { session: { access_token: "test-token" } },
            error: null,
          }),
        ),
      },
      from: jest.fn((table: string) => {
        if (table === "profiles") {
          return createMockQueryBuilder({ type: "client" });
        }
        return createMockQueryBuilder();
      }),
    };
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Sample address data for testing
const mockAddresses: Address[] = [
  {
    id: "1",
    county: "San Mateo",
    name: "Test Restaurant",
    street1: "123 Main St",
    street2: "Suite 100",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    locationNumber: "415-555-0123",
    parkingLoading: "Street parking",
    isRestaurant: true,
    isShared: false,
    createdBy: "test-user",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * TODO: REA-211 - This is a duplicate test file
 * The canonical AddressManager tests are in src/components/AddressManager/__tests__/
 */
describe.skip("AddressManager - Mobile Responsiveness", () => {
  const mockOnAddressesLoaded = jest.fn();
  const mockOnAddressSelected = jest.fn();
  const mockOnError = jest.fn();
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAddresses),
    });
  });

  describe("Responsive Management Buttons", () => {
    it("should stack management buttons vertically on mobile", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showManagementButtons={true}
        />,
      );

      // Wait for addresses to load
      const manageAddressesButton = screen.getByText("Manage Addresses");
      const addNewAddressButton = screen.getByText("Add New Address");

      // Check that buttons container has responsive classes
      const buttonsContainer = manageAddressesButton.closest("div");
      expect(buttonsContainer).toHaveClass(
        "flex",
        "flex-col",
        "gap-3",
        "sm:flex-row",
      );
    });

    it("should have responsive button spacing", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showManagementButtons={true}
        />,
      );

      const buttonsContainer = screen
        .getByText("Manage Addresses")
        .closest("div");
      expect(buttonsContainer).toHaveClass("gap-3", "sm:space-x-4");
    });

    it("should center text on mobile for manage addresses button", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showManagementButtons={true}
        />,
      );

      const manageAddressesButton = screen.getByText("Manage Addresses");
      expect(manageAddressesButton).toHaveClass("text-center", "sm:text-left");
    });
  });

  describe("Responsive Address Selection", () => {
    it("should have responsive select component sizing", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
        />,
      );

      // Wait for addresses to load
      const selectTrigger = screen.getByText("Select an address");
      expect(selectTrigger).toHaveClass("w-full");
    });

    it("should handle responsive address display in dropdown", async () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
        />,
      );

      // Wait for addresses to load
      await screen.findByText("Select an address");

      // Check that the select component is properly sized
      const selectContainer = screen
        .getByText("Select an address")
        .closest("div");
      expect(selectContainer).toBeInTheDocument();
    });
  });

  describe("Responsive Form Display", () => {
    it("should handle responsive form layout when adding new address", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showManagementButtons={true}
        />,
      );

      const addButton = screen.getByText("Add New Address");
      addButton.click();

      // Check that the form is displayed (this will be tested in AddAddressForm tests)
      expect(addButton).toBeInTheDocument();
    });

    it("should maintain responsive layout during form interactions", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showManagementButtons={true}
        />,
      );

      // Initially should show add button
      const addButton = screen.getByText("Add New Address");
      expect(addButton).toBeInTheDocument();

      // Click to show form
      addButton.click();

      // Button should change to cancel
      const cancelButton = screen.getByText("Cancel");
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe("Responsive Error Handling", () => {
    it("should display errors with responsive styling", () => {
      // Mock an error response
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
        />,
      );

      // Error should be handled by the component
      expect(mockOnError).toHaveBeenCalled();
    });

    it("should maintain responsive layout during error states", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
        />,
      );

      // Component should maintain its responsive structure even with errors
      const container = screen.getByText("Select an address").closest("div");
      expect(container).toBeInTheDocument();
    });
  });

  describe("Responsive Loading States", () => {
    it("should handle loading states with responsive layout", () => {
      // Mock a slow response
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}),
      );

      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
        />,
      );

      // Component should maintain responsive structure during loading
      const container = screen.getByText("Select an address").closest("div");
      expect(container).toBeInTheDocument();
    });
  });

  describe("Responsive Filter Display", () => {
    it("should handle responsive filter layout", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
        />,
      );

      // Check that filters are displayed with responsive layout
      const selectContainer = screen
        .getByText("Select an address")
        .closest("div");
      expect(selectContainer).toBeInTheDocument();
    });

    it("should maintain responsive behavior across different filter states", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
          defaultFilter="shared"
        />,
      );

      // Component should maintain responsive structure with different filter defaults
      const selectContainer = screen
        .getByText("Select an address")
        .closest("div");
      expect(selectContainer).toBeInTheDocument();
    });
  });

  describe("Responsive Component Integration", () => {
    it("should integrate responsive components properly", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
          showManagementButtons={true}
        />,
      );

      // Check that all responsive components are properly integrated
      const selectContainer = screen
        .getByText("Select an address")
        .closest("div");
      const manageButton = screen.getByText("Manage Addresses");
      const addButton = screen.getByText("Add New Address");

      expect(selectContainer).toBeInTheDocument();
      expect(manageButton).toBeInTheDocument();
      expect(addButton).toBeInTheDocument();
    });

    it("should handle responsive layout changes smoothly", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
          showManagementButtons={true}
        />,
      );

      // Component should handle layout changes without breaking responsive behavior
      const container = screen.getByText("Select an address").closest("div");
      expect(container).toBeInTheDocument();
    });
  });

  describe("Responsive Accessibility", () => {
    it("should maintain accessibility features with responsive layout", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
        />,
      );

      // Check that select component maintains accessibility
      const selectTrigger = screen.getByRole("combobox");
      expect(selectTrigger).toBeInTheDocument();
    });

    it("should have proper labeling for screen readers on mobile", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showFilters={true}
        />,
      );

      // Check that all interactive elements have proper labels
      const selectTrigger = screen.getByText("Select an address");
      expect(selectTrigger).toBeInTheDocument();
    });
  });

  describe("Responsive State Management", () => {
    it("should handle state changes with responsive layout", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showManagementButtons={true}
        />,
      );

      // Initially should show add button
      const addButton = screen.getByText("Add New Address");
      expect(addButton).toBeInTheDocument();

      // Click to toggle form state
      addButton.click();

      // Should now show cancel button
      const cancelButton = screen.getByText("Cancel");
      expect(cancelButton).toBeInTheDocument();

      // Click again to toggle back
      cancelButton.click();

      // Should show add button again
      const addButtonAgain = screen.getByText("Add New Address");
      expect(addButtonAgain).toBeInTheDocument();
    });

    it("should maintain responsive behavior during state transitions", () => {
      render(
        <AddressManager
          onAddressesLoaded={mockOnAddressesLoaded}
          onAddressSelected={mockOnAddressSelected}
          onError={mockOnError}
          showManagementButtons={true}
        />,
      );

      // Component should maintain responsive structure during all state changes
      const container = screen.getByText("Add New Address").closest("div");
      expect(container).toHaveClass("flex", "flex-col", "gap-3", "sm:flex-row");
    });
  });
});
