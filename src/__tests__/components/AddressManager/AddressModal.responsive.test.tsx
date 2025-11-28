import React from "react";
import { render, screen } from "@testing-library/react";
import AddressModal from "@/components/AddressManager/AddressModal";
import { Address } from "@/types/address";

// Mock the createClient function
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({
          data: { session: { access_token: "test-token" } },
          error: null,
        }),
      ),
    },
  })),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Sample address data for testing
const mockAddress: Address = {
  id: "1",
  county: "San Francisco",
  name: "Test Address",
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
};

/**
 * TODO: REA-211 - AddressModal responsive tests have component rendering issues
 */
describe.skip("AddressModal - Mobile Responsiveness", () => {
  const mockOnAddressUpdated = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAddress),
    });
  });

  describe("Responsive Dialog Sizing", () => {
    it("should have mobile-first responsive sizing", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const dialogContent = screen.getByRole("dialog");
      expect(dialogContent).toHaveClass(
        "w-[95vw]",
        "max-w-[500px]",
        "max-h-[90vh]",
      );
    });

    it("should have overflow handling for mobile", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const dialogContent = screen.getByRole("dialog");
      expect(dialogContent).toHaveClass("overflow-y-auto");
    });
  });

  describe("Responsive Form Layout", () => {
    it("should use mobile-first grid layout", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const formContainer = screen.getByRole("form");
      const gridContainer = formContainer.querySelector(".grid");
      expect(gridContainer).toHaveClass("grid", "gap-4", "py-4");
    });

    it("should stack form fields vertically on mobile", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      // Check that form fields use mobile-first responsive classes
      const countyField = screen.getByText("County").closest("div");
      expect(countyField).toHaveClass("grid-cols-1", "sm:grid-cols-4");
    });

    it("should have responsive gap spacing on mobile", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const countyField = screen.getByText("County").closest("div");
      expect(countyField).toHaveClass("gap-2", "sm:gap-4");
    });

    it("should align labels properly on mobile vs desktop", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const countyLabel = screen.getByText("County");
      expect(countyLabel).toHaveClass("sm:text-right");
    });
  });

  describe("Responsive Input Sizing", () => {
    it("should make inputs full width on mobile", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const nameInput = screen.getByPlaceholderText(
        "e.g. Main Office, Downtown Store",
      );
      expect(nameInput).toHaveClass("sm:col-span-3");
    });

    it("should have responsive column spans for inputs", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      // Check that inputs use responsive column spans
      const street1Input = screen.getByPlaceholderText("123 Main St");
      expect(street1Input).toHaveClass("sm:col-span-3");
    });
  });

  describe("Responsive Select Components", () => {
    it("should have responsive select trigger sizing", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const countySelect = screen.getByText("Please Select");
      expect(countySelect).toHaveClass("sm:col-span-3");
    });
  });

  describe("Responsive Checkbox Layout", () => {
    it("should span full width for checkboxes on mobile", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const restaurantCheckbox = screen.getByText("Is this a restaurant?");
      const checkboxContainer = restaurantCheckbox.closest("div");
      expect(checkboxContainer).toHaveClass("sm:col-span-4");
    });

    it("should maintain proper spacing for checkboxes", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const restaurantCheckbox = screen.getByText("Is this a restaurant?");
      const checkboxContainer = restaurantCheckbox.closest("div");
      expect(checkboxContainer).toHaveClass(
        "flex",
        "items-center",
        "space-x-2",
      );
    });
  });

  describe("Responsive Button Layout", () => {
    it("should have responsive submit button positioning", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const submitButton = screen.getByRole("button", { name: /save/i });
      const buttonContainer = submitButton.closest("div");
      expect(buttonContainer).toHaveClass("flex", "justify-end");
    });
  });

  describe("Responsive Form Field Groups", () => {
    it("should handle all form fields with responsive layout", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      // Check that all form fields are present and have responsive classes
      const formFields = [
        "County",
        "Name",
        "Street Address 1",
        "Street Address 2",
        "City",
        "State",
        "Zip",
        "Location Phone Number",
        "Parking / Loading",
      ];

      formFields.forEach((fieldName) => {
        const field = screen.getByText(fieldName);
        const fieldContainer = field.closest("div");
        expect(fieldContainer).toHaveClass("grid-cols-1", "sm:grid-cols-4");
      });
    });

    it("should maintain consistent responsive behavior across all fields", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      // All input fields should have the same responsive pattern
      const inputs = screen.getAllByRole("textbox");
      inputs.forEach((input) => {
        expect(input).toHaveClass("sm:col-span-3");
      });
    });
  });

  describe("Responsive Modal Behavior", () => {
    it("should handle mobile viewport constraints", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const dialogContent = screen.getByRole("dialog");

      // Should have mobile-first sizing
      expect(dialogContent).toHaveClass("w-[95vw]");

      // Should have reasonable max dimensions
      expect(dialogContent).toHaveClass("max-w-[500px]", "max-h-[90vh]");
    });

    it("should be scrollable on mobile devices", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const dialogContent = screen.getByRole("dialog");
      expect(dialogContent).toHaveClass("overflow-y-auto");
    });
  });

  describe("Responsive Edit Mode", () => {
    it("should maintain responsive layout when editing existing address", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={mockAddress}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      // Check that the modal title changes appropriately
      const title = screen.getByText("Edit Address");
      expect(title).toBeInTheDocument();

      // Check that form fields maintain responsive classes
      const countyField = screen.getByText("County").closest("div");
      expect(countyField).toHaveClass("grid-cols-1", "sm:grid-cols-4");
    });

    it("should handle form validation with responsive layout", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      // Form should maintain responsive layout even with validation
      const formContainer = screen.getByRole("form");
      expect(formContainer).toBeInTheDocument();
    });
  });

  describe("Responsive Accessibility", () => {
    it("should maintain proper labeling for screen readers on mobile", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      // Check that all form fields have proper labels
      const requiredFields = [
        "County",
        "Street Address 1",
        "City",
        "State",
        "Zip",
      ];
      requiredFields.forEach((fieldName) => {
        const field = screen.getByText(fieldName);
        expect(field).toBeInTheDocument();
      });
    });

    it("should have proper form structure for mobile assistive technologies", () => {
      render(
        <AddressModal
          onAddressUpdated={mockOnAddressUpdated}
          addressToEdit={null}
          isOpen={true}
          onClose={mockOnClose}
        />,
      );

      const form = screen.getByRole("form");
      expect(form).toBeInTheDocument();

      // Check that form has proper structure
      const formFields = form.querySelectorAll("input, select");
      expect(formFields.length).toBeGreaterThan(0);
    });
  });
});
