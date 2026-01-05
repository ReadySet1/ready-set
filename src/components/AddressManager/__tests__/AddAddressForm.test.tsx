import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddAddressForm from "../AddAddressForm";
import { COUNTIES } from "@/components/Auth/SignUp/ui/FormData";

// Mock the FormData import
jest.mock("@/components/Auth/SignUp/ui/FormData", () => ({
  COUNTIES: [
    { value: "San Francisco", label: "San Francisco" },
    { value: "San Mateo", label: "San Mateo" },
    { value: "Santa Clara", label: "Santa Clara" },
    { value: "Alameda", label: "Alameda" },
  ],
  US_STATES: [
    { value: "CA", label: "California" },
    { value: "NY", label: "New York" },
    { value: "TX", label: "Texas" },
  ],
}));

// Mock fetch
global.fetch = jest.fn();

const mockOnSubmit = jest.fn();
const mockOnClose = jest.fn();

const defaultProps = {
  onSubmit: mockOnSubmit,
  onClose: mockOnClose,
};

describe("AddAddressForm County Dropdown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to find County select - it's the first select (before State select)
  const getCountySelectTrigger = () => {
    // Find the label element with exact text "County" followed by required indicator
    const countyLabel = screen.getByText((content, element) => {
      return element?.tagName === 'LABEL' && content.startsWith('County');
    });
    const countyContainer = countyLabel.closest(".space-y-2");
    return within(countyContainer!).getByTestId("select-trigger");
  };

  // These tests verify Radix Select interaction behavior
  it("renders county dropdown with all available counties", async () => {
    render(<AddAddressForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    const countyTrigger = getCountySelectTrigger();
    await userEvent.click(countyTrigger);

    // Check that all counties are available in the dropdown
    await waitFor(() => {
      for (const county of COUNTIES) {
        expect(screen.getByRole("option", { name: county.label })).toBeInTheDocument();
      }
    });
  });

  it("allows county selection and preserves the value", async () => {
    render(<AddAddressForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    const countyTrigger = getCountySelectTrigger();
    await userEvent.click(countyTrigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "San Francisco" })).toBeInTheDocument();
    });

    const sanFranciscoOption = screen.getByRole("option", { name: "San Francisco" });
    await userEvent.click(sanFranciscoOption);

    await waitFor(() => {
      expect(screen.getByText("San Francisco")).toBeInTheDocument();
    });
  });

  it("initializes with provided counties when allowedCounties prop is passed", async () => {
    const allowedCounties = ["San Francisco", "San Mateo"];

    render(
      <AddAddressForm {...defaultProps} allowedCounties={allowedCounties} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    const countyTrigger = getCountySelectTrigger();
    await userEvent.click(countyTrigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "San Francisco" })).toBeInTheDocument();
    });

    expect(screen.getByRole("option", { name: "San Francisco" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "San Mateo" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Santa Clara" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alameda" })).not.toBeInTheDocument();
  });

  it("falls back to all counties when API call fails", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    render(<AddAddressForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    const countyTrigger = getCountySelectTrigger();
    await userEvent.click(countyTrigger);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "San Francisco" })).toBeInTheDocument();
    });

    for (const county of COUNTIES) {
      expect(screen.getByRole("option", { name: county.label })).toBeInTheDocument();
    }
  });

  it("handles empty county value properly", async () => {
    render(<AddAddressForm {...defaultProps} />);

    // Wait for form to render
    await waitFor(() => {
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    // County trigger should exist but have no visible selected value (empty state)
    const countyTrigger = getCountySelectTrigger();
    expect(countyTrigger).toBeInTheDocument();

    // The placeholder is stored as an attribute on select-value, not visible text
    const selectValue = within(countyTrigger).getByTestId("select-value");
    expect(selectValue).toHaveAttribute("placeholder", "Select a county");
  });

  it("displays validation error when county is not selected on form submission", async () => {
    render(<AddAddressForm {...defaultProps} />);

    // Wait for form to render
    await waitFor(() => {
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    // Fill required input fields (but NOT county or state - they're Select components)
    // Just fill plain inputs to trigger partial validation
    // Use input IDs directly since label text is not unique (Street Address matches both street1 and street2)
    await userEvent.type(screen.getByRole("textbox", { name: /^Street Address \*$/i }), "123 Main St");
    await userEvent.type(screen.getByRole("textbox", { name: /^City/i }), "San Francisco");
    await userEvent.type(screen.getByRole("textbox", { name: /^ZIP Code/i }), "94103");

    // Try to submit without selecting county
    const submitButton = screen.getByRole("button", { name: /save address/i });
    await userEvent.click(submitButton);

    // Should show validation error for county
    await waitFor(() => {
      expect(screen.getByText(/County is required/i)).toBeInTheDocument();
    });
  });

  it("submits form successfully when all required fields including county are filled", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(<AddAddressForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    const countyTrigger = getCountySelectTrigger();
    await userEvent.click(countyTrigger);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "San Francisco" })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("option", { name: "San Francisco" }));

    // Use specific selectors to avoid ambiguity with multiple Street Address fields
    await userEvent.type(screen.getByRole("textbox", { name: /^Street Address \*$/i }), "123 Main St");
    await userEvent.type(screen.getByRole("textbox", { name: /^City/i }), "San Francisco");

    // State selection - click trigger and select an option
    const stateLabel = screen.getByText((content, element) => {
      return element?.tagName === 'LABEL' && content.startsWith('State');
    });
    const stateContainer = stateLabel.closest(".space-y-2");
    const stateTrigger = within(stateContainer!).getByTestId("select-trigger");
    await userEvent.click(stateTrigger);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "California" })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("option", { name: "California" }));

    await userEvent.type(screen.getByRole("textbox", { name: /^ZIP Code/i }), "94103");

    const submitButton = screen.getByRole("button", { name: /save address/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          county: "San Francisco",
          street1: "123 Main St",
          city: "San Francisco",
          // State select sends the value, which corresponds to "California" label
          state: "CA",
          zip: "94103",
        }),
      );
    }, { timeout: 3000 });
  });

  it("initializes form with provided initialValues including county", async () => {
    const initialValues = {
      county: "San Mateo",
      street1: "456 Oak Ave",
      city: "Redwood City",
      state: "CA",
      zip: "94402",
    };

    render(<AddAddressForm {...defaultProps} initialValues={initialValues} />);

    // Wait for component to load with initial values
    await waitFor(() => {
      // County should show the selected value
      expect(screen.getByText("San Mateo")).toBeInTheDocument();
    });

    // Check that initial values are populated in inputs
    expect(screen.getByDisplayValue("456 Oak Ave")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Redwood City")).toBeInTheDocument();
    // State is a Select - the mock shows the value directly
    expect(screen.getByText("CA")).toBeInTheDocument();
    expect(screen.getByDisplayValue("94402")).toBeInTheDocument();
  });

  it("renders form header and submit button", async () => {
    render(<AddAddressForm {...defaultProps} />);

    // Wait for form to render
    await waitFor(() => {
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    // Check submit button exists
    expect(screen.getByRole("button", { name: /save address/i })).toBeInTheDocument();

    // Check cancel button exists
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls onClose when cancel button is clicked", async () => {
    render(<AddAddressForm {...defaultProps} />);

    // Wait for form to render
    await waitFor(() => {
      expect(screen.getByText("Add New Address")).toBeInTheDocument();
    });

    // Click cancel button
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
