import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CateringRequestForm from "../CateringRequestForm";
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

// Mock Next.js Link component
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock OrderConfirmationModal - capture props to verify modal is shown with correct data
const mockOrderConfirmationModal = jest.fn();
jest.mock("../OrderConfirmationModal", () => ({
  __esModule: true,
  default: (props: any) => {
    mockOrderConfirmationModal(props);
    if (props.isOpen) {
      return (
        <div data-testid="order-confirmation-modal">
          <span data-testid="modal-order-number">{props.orderNumber}</span>
          <button data-testid="modal-close" onClick={props.onClose}>Close</button>
        </div>
      );
    }
    return null;
  },
}));

// Mock AddressSelector component (CateringRequestForm uses AddressSelector, not AddressManager)
// Store callbacks separately for pickup and delivery
const addressCallbacks: { pickup?: (address: any) => void; delivery?: (address: any) => void } = {};
const mockHandleAddressSelect = jest.fn((address: any) => {
  // Call both callbacks when selecting an address (for convenience in tests)
  addressCallbacks.pickup?.(address);
  addressCallbacks.delivery?.(address);
});

jest.mock("@/components/AddressSelector", () => {
  const MockSelector = (props: { onSelect: (address: any) => void; type?: string }) => {
    // Store callback based on type prop
    if (props.type === "pickup") {
      addressCallbacks.pickup = props.onSelect;
    } else {
      addressCallbacks.delivery = props.onSelect;
    }
    return <div data-testid="mock-address-manager">Mock Address Selector</div>;
  };
  return {
    __esModule: true,
    AddressSelector: MockSelector,
    default: MockSelector,
  };
});

// Mock file upload hook
jest.mock("@/hooks/use-job-application-upload", () => ({
  useJobApplicationUpload: () => ({
    uploadedFiles: [],
    deleteFile: jest.fn(),
    uploadFile: jest.fn(),
    isUploading: false,
    updateEntityId: jest.fn(),
  }),
}));

// Mock CostEstimatorCard component
jest.mock("../CostEstimatorCard", () => ({
  __esModule: true,
  CostEstimatorCard: ({ headcount, onEstimatedCostChange }: { headcount: number; onEstimatedCostChange?: (cost: number) => void }) => (
    <div data-testid="mock-cost-estimator" data-headcount={headcount}>
      Mock Cost Estimator
      <button
        data-testid="apply-estimate-button"
        onClick={() => onEstimatedCostChange?.(100)}
      >
        Apply Estimate
      </button>
    </div>
  ),
  default: ({ headcount, onEstimatedCostChange }: { headcount: number; onEstimatedCostChange?: (cost: number) => void }) => (
    <div data-testid="mock-cost-estimator" data-headcount={headcount}>
      Mock Cost Estimator
      <button
        data-testid="apply-estimate-button"
        onClick={() => onEstimatedCostChange?.(100)}
      >
        Apply Estimate
      </button>
    </div>
  ),
}));

// Mock Supabase client - must return a Promise since createClient is async
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: "test-user-id",
                email: "test@example.com",
                user_metadata: { name: "Test User" },
                app_metadata: { role: "vendor" },
              },
            },
          },
          error: null,
        }),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
    })
  ),
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

// Mock addresses data
const mockAddresses: Address[] = [
  {
    id: "1",
    street1: "123 Test St",
    street2: null,
    city: "Test City",
    state: "TS",
    zip: "12345",
    county: null,
    locationNumber: null,
    parkingLoading: null,
    name: null,
    isRestaurant: false,
    isShared: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
  },
];

const mockAddress = {
  id: "1",
  street1: "123 Test St",
  street2: null,
  city: "Test City",
  state: "TS",
  zip: "12345",
};

// Helper to wait for component initialization (Supabase client + session loading)
const waitForInit = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });
};

describe("CateringRequestForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockHandleAddressSelect.mockClear();
    mockOrderConfirmationModal.mockClear();
    // Clear address callbacks
    addressCallbacks.pickup = undefined;
    addressCallbacks.delivery = undefined;

    // Default mock for useUser - tests can override as needed
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

    // Default successful fetch mock
    mockFetch.mockImplementation(
      async (
        url: RequestInfo | URL,
        options?: RequestInit,
      ): Promise<Response> => {
        const urlString = url.toString();

        if (
          urlString.includes("/api/catering-requests") &&
          options?.method === "POST"
        ) {
          return new Response(
            JSON.stringify({
              message: "Catering request created successfully",
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
      render(<CateringRequestForm />);
    });

    // Check that key form elements are rendered
    // There are 2 AddressSelectors (pickup and delivery)
    expect(screen.getAllByTestId("mock-address-manager")).toHaveLength(2);
    // Form labels - component uses "Brokerage / Direct" label
    expect(screen.getByLabelText(/brokerage/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/order number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/headcount/i)).toBeInTheDocument();
  });

  it("shows confirmation modal after successful form submission for client users", async () => {
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
      render(<CateringRequestForm />);
    });

    // Wait for form to initialize and Supabase client + session to be loaded
    await waitForInit();
    await waitForInit();

    // Fill out the form with valid data
    // Fill brokerage field
    const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
    await user.selectOptions(brokerageSelect, "Ez Cater");

    // Fill order number
    await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

    // Fill date - clear first, then type
    const dateInput = screen.getByLabelText(/date/i);
    await user.clear(dateInput);
    await user.type(dateInput, "2024-12-31");

    // Fill headcount
    await user.type(screen.getByLabelText(/headcount/i), "50");

    // Fill pickup time
    await user.type(screen.getByLabelText(/pick up time/i), "10:00");

    // Fill arrival time
    await user.type(screen.getByLabelText(/arrival time/i), "11:00");

    // Fill client attention
    await user.type(screen.getByLabelText(/client.*attention/i), "John Doe");

    // Fill order total
    await user.type(screen.getByLabelText(/order total/i), "1000");

    // Select "No" for host requirement
    const hostNoRadio = screen.getByRole("radio", { name: /no/i });
    await user.click(hostNoRadio);

    // Simulate address selection for both pickup and delivery
    await act(async () => {
      mockHandleAddressSelect(mockAddress);
    });
    await waitForInit();

    // Submit the form using fireEvent.submit (more reliable than button click in tests)
    const submitButton = screen.getByRole("button", {
      name: /submit catering request/i,
    });
    const form = submitButton.closest('form');

    await act(async () => {
      if (form) {
        fireEvent.submit(form);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Wait for fetch to be called first
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Verify that confirmation modal is shown with the order number
    await waitFor(() => {
      expect(screen.getByTestId("order-confirmation-modal")).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByTestId("modal-order-number")).toHaveTextContent("TEST-12345");
  });

  it("shows confirmation modal after successful form submission for vendor users", async () => {
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
      render(<CateringRequestForm />);
    });

    // Wait for form to initialize and Supabase client + session to be loaded
    await waitForInit();
    await waitForInit();

    // Fill out the form with valid data
    // Fill brokerage field
    const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
    await user.selectOptions(brokerageSelect, "Ez Cater");

    // Fill order number
    await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

    // Fill date - clear first, then type
    const dateInput = screen.getByLabelText(/date/i);
    await user.clear(dateInput);
    await user.type(dateInput, "2024-12-31");

    // Fill headcount
    await user.type(screen.getByLabelText(/headcount/i), "50");

    // Fill pickup time
    await user.type(screen.getByLabelText(/pick up time/i), "10:00");

    // Fill arrival time
    await user.type(screen.getByLabelText(/arrival time/i), "11:00");

    // Fill client attention
    await user.type(screen.getByLabelText(/client.*attention/i), "John Doe");

    // Fill order total
    await user.type(screen.getByLabelText(/order total/i), "1000");

    // Select "No" for host requirement
    const hostNoRadio = screen.getByRole("radio", { name: /no/i });
    await user.click(hostNoRadio);

    // Simulate address selection for both pickup and delivery
    await act(async () => {
      mockHandleAddressSelect(mockAddress);
    });
    await waitForInit();

    // Submit the form using fireEvent.submit (more reliable than button click in tests)
    const submitButton = screen.getByRole("button", {
      name: /submit catering request/i,
    });
    const form = submitButton.closest('form');

    await act(async () => {
      if (form) {
        fireEvent.submit(form);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Wait for fetch to be called first
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Verify that confirmation modal is shown with the order number
    await waitFor(() => {
      expect(screen.getByTestId("order-confirmation-modal")).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByTestId("modal-order-number")).toHaveTextContent("TEST-12345");
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
          url.toString().includes("/api/catering-requests") &&
          options?.method === "POST"
        ) {
          return new Response(
            JSON.stringify({ message: "Failed to create catering request" }),
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
      render(<CateringRequestForm />);
    });

    // Wait for form to initialize and Supabase client + session to be loaded
    await waitForInit();
    await waitForInit();

    // Fill out the form with valid data
    const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
    await user.selectOptions(brokerageSelect, "Ez Cater");
    await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

    const dateInput = screen.getByLabelText(/date/i);
    await user.clear(dateInput);
    await user.type(dateInput, "2024-12-31");

    await user.type(screen.getByLabelText(/headcount/i), "50");
    await user.type(screen.getByLabelText(/pick up time/i), "10:00");
    await user.type(screen.getByLabelText(/arrival time/i), "11:00");
    await user.type(screen.getByLabelText(/client.*attention/i), "John Doe");
    await user.type(screen.getByLabelText(/order total/i), "1000");

    const hostNoRadio = screen.getByRole("radio", { name: /no/i });
    await user.click(hostNoRadio);

    await act(async () => {
      mockHandleAddressSelect(mockAddress);
    });
    await waitForInit();

    // Submit the form using fireEvent.submit (more reliable than button click in tests)
    const submitButton = screen.getByRole("button", {
      name: /submit catering request/i,
    });
    const form = submitButton.closest('form');

    await act(async () => {
      if (form) {
        fireEvent.submit(form);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Wait for fetch to be called first
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Verify that router.push was NOT called since submission failed
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("submits the form with correct data structure and shows modal", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<CateringRequestForm />);
    });

    // Wait for form to initialize and Supabase client + session to be loaded
    await waitForInit();
    await waitForInit();

    // Fill out the form
    const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
    await user.selectOptions(brokerageSelect, "Ez Cater");
    await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

    // Clear date field first, then type
    const dateInput = screen.getByLabelText(/date/i);
    await user.clear(dateInput);
    await user.type(dateInput, "2024-12-31");

    await user.type(screen.getByLabelText(/headcount/i), "50");
    await user.type(screen.getByLabelText(/pick up time/i), "10:00");
    await user.type(screen.getByLabelText(/arrival time/i), "11:00");
    await user.type(screen.getByLabelText(/client.*attention/i), "John Doe");
    await user.type(screen.getByLabelText(/order total/i), "1000");

    const hostNoRadio = screen.getByRole("radio", { name: /no/i });
    await user.click(hostNoRadio);

    // Simulate address selection for both pickup and delivery
    await act(async () => {
      mockHandleAddressSelect(mockAddress);
    });
    await waitForInit();

    // Submit the form using fireEvent.submit (more reliable than button click in tests)
    const submitButton = screen.getByRole("button", {
      name: /submit catering request/i,
    });
    const form = submitButton.closest('form');

    await act(async () => {
      if (form) {
        fireEvent.submit(form);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Wait for fetch to be called
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Verify the API call was made with correct data
    expect(mockFetch).toHaveBeenCalledWith("/api/catering-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining("TEST-12345"),
    });

    // Verify modal is shown instead of direct redirect
    await waitFor(() => {
      expect(screen.getByTestId("order-confirmation-modal")).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
