import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddAddressForm from "../AddAddressForm";
import { COUNTIES } from "@/components/Auth/SignUp/ui/FormData";

// Mock the FormData import
jest.mock("@/components/Auth/SignUp/ui/FormData", () => ({
  COUNTIES: [
    { value: "san-francisco", label: "San Francisco" },
    { value: "san-mateo", label: "San Mateo" },
    { value: "santa-clara", label: "Santa Clara" },
    { value: "alameda", label: "Alameda" },
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

  it("renders county dropdown with all available counties", async () => {
    render(<AddAddressForm {...defaultProps} />);

    // Find and click the county dropdown
    const countyTrigger = screen.getByRole("combobox", { name: /county/i });
    expect(countyTrigger).toBeInTheDocument();

    await userEvent.click(countyTrigger);

    // Check that all counties are available
    for (const county of COUNTIES) {
      expect(screen.getByText(county.label)).toBeInTheDocument();
    }
  });

  it("allows county selection and preserves the value", async () => {
    render(<AddAddressForm {...defaultProps} />);

    const countyTrigger = screen.getByRole("combobox", { name: /county/i });
    await userEvent.click(countyTrigger);

    // Select San Francisco
    const sanFranciscoOption = screen.getByText("San Francisco");
    await userEvent.click(sanFranciscoOption);

    // Verify the selection persists
    expect(countyTrigger).toHaveTextContent("San Francisco");
  });

  it("initializes with provided counties when allowedCounties prop is passed", async () => {
    const allowedCounties = ["san-francisco", "san-mateo"];

    render(
      <AddAddressForm {...defaultProps} allowedCounties={allowedCounties} />,
    );

    const countyTrigger = screen.getByRole("combobox", { name: /county/i });
    await userEvent.click(countyTrigger);

    // Should only show allowed counties
    expect(screen.getByText("San Francisco")).toBeInTheDocument();
    expect(screen.getByText("San Mateo")).toBeInTheDocument();
    expect(screen.queryByText("Santa Clara")).not.toBeInTheDocument();
    expect(screen.queryByText("Alameda")).not.toBeInTheDocument();
  });

  it("falls back to all counties when API call fails", async () => {
    // Mock failed API call
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    render(<AddAddressForm {...defaultProps} />);

    await waitFor(() => {
      const countyTrigger = screen.getByRole("combobox", { name: /county/i });
      expect(countyTrigger).toBeInTheDocument();
    });

    const countyTrigger = screen.getByRole("combobox", { name: /county/i });
    await userEvent.click(countyTrigger);

    // Should show all counties as fallback
    for (const county of COUNTIES) {
      expect(screen.getByText(county.label)).toBeInTheDocument();
    }
  });

  it("handles empty county value properly", async () => {
    render(<AddAddressForm {...defaultProps} />);

    const countyTrigger = screen.getByRole("combobox", { name: /county/i });

    // Should have placeholder text when no value is selected
    expect(countyTrigger).toHaveTextContent("Select County");
  });

  it("displays validation error when county is not selected on form submission", async () => {
    render(<AddAddressForm {...defaultProps} />);

    // Fill required fields except county
    await userEvent.type(
      screen.getByLabelText(/street address \*/i),
      "123 Main St",
    );
    await userEvent.type(screen.getByLabelText(/city/i), "San Francisco");
    await userEvent.type(screen.getByLabelText(/state/i), "CA");
    await userEvent.type(screen.getByLabelText(/zip code/i), "94103");

    // Try to submit without selecting county
    const submitButton = screen.getByRole("button", { name: /save address/i });
    await userEvent.click(submitButton);

    // Should show validation error
    expect(screen.getByText("County is required")).toBeInTheDocument();
  });

  it("submits form successfully when all required fields including county are filled", async () => {
    render(<AddAddressForm {...defaultProps} />);

    // Fill all required fields
    const countyTrigger = screen.getByRole("combobox", { name: /county/i });
    await userEvent.click(countyTrigger);
    await userEvent.click(screen.getByText("San Francisco"));

    await userEvent.type(
      screen.getByLabelText(/street address \*/i),
      "123 Main St",
    );
    await userEvent.type(screen.getByLabelText(/city/i), "San Francisco");
    await userEvent.type(screen.getByLabelText(/state/i), "CA");
    await userEvent.type(screen.getByLabelText(/zip code/i), "94103");

    // Submit form
    const submitButton = screen.getByRole("button", { name: /save address/i });
    await userEvent.click(submitButton);

    // Should call onSubmit with correct data
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        county: "san-francisco",
        street1: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94103",
      }),
    );
  });

  it("initializes form with provided initialValues including county", async () => {
    const initialValues = {
      county: "san-mateo",
      street1: "456 Oak Ave",
      city: "San Mateo",
      state: "CA",
      zip: "94402",
    };

    render(<AddAddressForm {...defaultProps} initialValues={initialValues} />);

    // Check that initial values are populated
    const countyTrigger = screen.getByRole("combobox", { name: /county/i });
    expect(countyTrigger).toHaveTextContent("San Mateo");

    expect(screen.getByDisplayValue("456 Oak Ave")).toBeInTheDocument();
    expect(screen.getByDisplayValue("San Mateo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CA")).toBeInTheDocument();
    expect(screen.getByDisplayValue("94402")).toBeInTheDocument();
  });

  it("handles county selection with undefined field value gracefully", async () => {
    render(<AddAddressForm {...defaultProps} />);

    const countyTrigger = screen.getByRole("combobox", { name: /county/i });

    // The component should handle undefined field.value by defaulting to empty string
    expect(() => userEvent.click(countyTrigger)).not.toThrow();

    await userEvent.click(countyTrigger);
    expect(screen.getByText("San Francisco")).toBeInTheDocument();
  });
});
