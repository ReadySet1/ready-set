import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnDemandOrderForm from "../OnDemandForm";
import { Address } from "@/types/address";

// Mock Next.js router
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock AddressManager component
const mockHandleAddressSelect = jest.fn();
jest.mock("@/components/AddressManager", () => ({
  __esModule: true,
  default: (props: { onAddressSelected: (address: any) => void }) => {
    mockHandleAddressSelect.mockImplementation(props.onAddressSelected);
    return <div data-testid="mock-address-manager">Mock Address Manager</div>;
  },
}));

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
        error: null,
      }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  })),
}));

// Mock fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock scrollIntoView for JSDOM
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock ResizeObserver for JSDOM
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const mockAddress = {
  id: "1",
  street1: "123 Test St",
  street2: null,
  city: "Test City",
  state: "TS",
  zip: "12345",
};

describe("OnDemandOrderForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockHandleAddressSelect.mockClear();

    // Default successful fetch mock
    mockFetch.mockImplementation(
      async (
        url: RequestInfo | URL,
        options?: RequestInit,
      ): Promise<Response> => {
        const urlString = url.toString();

        if (
          urlString.includes("/api/on-demand") &&
          options?.method === "POST"
        ) {
          return new Response(
            JSON.stringify({
              message: "On-demand request created successfully",
              orderId: "test-order-id",
            }),
            {
              status: 201,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        return new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
  });

  it("renders the form correctly", async () => {
    await act(async () => {
      render(<OnDemandOrderForm />);
    });

    // Check that key form elements are rendered
    expect(screen.getAllByTestId("mock-address-manager")).toHaveLength(2); // Two address managers (pickup and delivery)
    expect(screen.getByLabelText(/brokerage.*direct/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/order number/i)).toBeInTheDocument();
  });

  it("redirects to vendor dashboard after successful form submission", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<OnDemandOrderForm />);
    });

    // Fill out the form with valid data
    await act(async () => {
      // Fill brokerage/direct field
      const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
      await user.selectOptions(brokerageSelect, "direct");

      // Fill order number
      await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

      // Simulate address selection for pickup
      mockHandleAddressSelect(mockAddress);
    });

    // Submit the form
    await act(async () => {
      const submitButton = screen.getByRole("button", {
        name: /submit.*request/i,
      });
      await user.click(submitButton);
    });

    // Verify that router.push was called with the vendor dashboard path
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/vendor");
    });
  });

  it("does not redirect on submission failure", async () => {
    const user = userEvent.setup();

    // Mock fetch to return error
    mockFetch.mockImplementation(
      async (
        url: RequestInfo | URL,
        options?: RequestInit,
      ): Promise<Response> => {
        if (
          url.toString().includes("/api/on-demand") &&
          options?.method === "POST"
        ) {
          return new Response(
            JSON.stringify({ message: "Failed to create on-demand request" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    await act(async () => {
      render(<OnDemandOrderForm />);
    });

    // Fill out the form with valid data
    await act(async () => {
      const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
      await user.selectOptions(brokerageSelect, "direct");
      await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

      mockHandleAddressSelect(mockAddress);
    });

    // Submit the form
    await act(async () => {
      const submitButton = screen.getByRole("button", {
        name: /submit.*request/i,
      });
      await user.click(submitButton);
    });

    // Verify that router.push was NOT called since submission failed
    await waitFor(() => {
      // Ensure no redirect happened
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("submits the form with correct data structure", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<OnDemandOrderForm />);
    });

    // Fill out the form
    await act(async () => {
      const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
      await user.selectOptions(brokerageSelect, "direct");
      await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

      mockHandleAddressSelect(mockAddress);

      const submitButton = screen.getByRole("button", {
        name: /submit.*request/i,
      });
      await user.click(submitButton);
    });

    // Verify the API call was made with correct data
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/on-demand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("TEST-12345"),
      });

      // Verify redirect happened
      expect(mockPush).toHaveBeenCalledWith("/vendor");
    });
  });

  it("validates required fields before submission", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<OnDemandOrderForm />);
    });

    const submitButton = screen.getByRole("button", {
      name: /submit.*request/i,
    });

    await act(async () => {
      await user.click(submitButton);
    });

    // Check for validation messages (this will depend on the actual validation implementation)
    await waitFor(() => {
      // Should not redirect if validation fails
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
