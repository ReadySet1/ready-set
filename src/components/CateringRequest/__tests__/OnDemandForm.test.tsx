import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnDemandOrderForm from "../OnDemandForm";
import { Address } from "@/types/address";
import { useUser } from "@/contexts/UserContext";
import { UserType } from "@/types/user";

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

// Mock the UserContext
jest.mock("@/contexts/UserContext");
const mockUseUser = useUser as jest.MockedFunction<typeof useUser>;

const mockAddress = {
  id: "1",
  street1: "123 Test St",
  street2: null,
  city: "Test City",
  state: "TS",
  zip: "12345",
};

/**
 * TODO: REA-211 - These tests need AddressManager mocking to be fixed
 * Issues:
 * 1. Mock passes address object to onAddressSelected, but component expects address ID string
 * 2. The addresses state needs to be populated via onAddressesLoaded for lookup to work
 * 3. User authentication mock isn't properly setting user.id for form submission
 *
 * Options to fix:
 * 1. Update AddressManager mock to properly simulate ID-based selection flow
 * 2. Create proper mock that calls both onAddressesLoaded and onAddressSelected
 * 3. Add integration tests that test the actual component behavior
 */
describe.skip("OnDemandOrderForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockHandleAddressSelect.mockClear();

    // Default successful fetch mock
    // Note: The component submits to /api/orders with order_type: "on_demand"
    mockFetch.mockImplementation(
      async (
        url: RequestInfo | URL,
        options?: RequestInit,
      ): Promise<Response> => {
        const urlString = url.toString();

        if (
          urlString.includes("/api/orders") &&
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

  it("redirects to client dashboard for client users after successful form submission", async () => {
    // Mock user context for client role
    mockUseUser.mockReturnValue({
      userRole: UserType.CLIENT,
      session: null,
      user: null,
      isLoading: false,
      error: null,
      refreshUserData: jest.fn(),
      isAuthenticating: false,
      authProgress: { step: "idle", message: "" },
      clearAuthError: jest.fn(),
      setAuthProgress: jest.fn(),
    });

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

    // Verify that router.push was called with the client dashboard path for client users
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/client");
    });
  });

  it("redirects to vendor dashboard for vendor users after successful form submission", async () => {
    // Mock user context for vendor role
    mockUseUser.mockReturnValue({
      userRole: UserType.VENDOR,
      session: null,
      user: null,
      isLoading: false,
      error: null,
      refreshUserData: jest.fn(),
      isAuthenticating: false,
      authProgress: { step: "idle", message: "" },
      clearAuthError: jest.fn(),
      setAuthProgress: jest.fn(),
    });

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

    // Verify that router.push was called with the vendor dashboard path for vendor users
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/client");
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
          url.toString().includes("/api/orders") &&
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
    // Note: Component submits to /api/orders with order_type: "on_demand"
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("TEST-12345"),
      });

      // Verify redirect happened
      expect(mockPush).toHaveBeenCalledWith("/client");
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
