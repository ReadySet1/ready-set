import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnDemandOrderForm from "../OnDemandForm";
import { Address } from "@/types/address";
import { useUser } from "@/contexts/UserContext";
import { UserType } from "@/types/user";
import { parseCreateOrderBody } from "@/app/api/orders/create-order-schema";
import { localTimeToUtc } from "@/lib/utils/timezone";

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

// Mock react-hot-toast - need to mock the default export as a function with methods
jest.mock("react-hot-toast", () => {
  const mockToast = Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  });
  return {
    __esModule: true,
    default: mockToast,
  };
});

// Mock AddressManager component - store callbacks for pickup and delivery
// OnDemandForm uses onAddressSelected(addressId) which receives just an ID,
// then looks up the address from addresses state populated by onAddressesLoaded
// Uses showManagementButtons prop to distinguish pickup (undefined) from delivery (false)
const addressSelectCallbacks: { pickup?: (addressId: string) => void; delivery?: (addressId: string) => void } = {};
const addressLoadCallbacks: { pickup?: (addresses: any[]) => void; delivery?: (addresses: any[]) => void } = {};

jest.mock("@/components/AddressManager", () => ({
  __esModule: true,
  default: (props: {
    onAddressSelected: (addressId: string) => void;
    onAddressesLoaded?: (addresses: any[]) => void;
    defaultFilter?: string;
    showFilters?: boolean;
    showManagementButtons?: boolean;
  }) => {
    // Distinguish pickup from delivery using showManagementButtons prop
    // Pickup: showManagementButtons is undefined (default)
    // Delivery: showManagementButtons is explicitly false
    const isPickup = props.showManagementButtons !== false;

    if (isPickup) {
      addressSelectCallbacks.pickup = props.onAddressSelected;
      addressLoadCallbacks.pickup = props.onAddressesLoaded;
    } else {
      addressSelectCallbacks.delivery = props.onAddressSelected;
      addressLoadCallbacks.delivery = props.onAddressesLoaded;
    }
    return <div data-testid="mock-address-manager">Mock Address Manager</div>;
  },
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
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "test-user-id", email: "test@example.com" } },
          error: null,
        }),
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: "test-user-id",
                email: "test@example.com",
                user_metadata: { name: "Test User" },
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

const mockAddress = {
  id: "11111111-1111-4111-8111-111111111111",
  street1: "123 Test St",
  street2: null,
  city: "Test City",
  state: "TS",
  zip: "12345",
};

const mockDeliveryAddress = {
  id: "22222222-2222-4222-8222-222222222222",
  street1: "456 Dropoff Ave",
  street2: null,
  city: "Test City",
  state: "TS",
  zip: "12345",
};

// Helper to wait for component initialization (Supabase client + user loading)
// The component has a chain of async effects that need to complete:
// 1. createClient() -> setSupabase()
// 2. getUser() -> setUser()
// Each step involves Promise resolution + React state update + re-render
const waitForInit = async () => {
  await act(async () => {
    // Use a real delay to allow the async initialization chain to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });
};

/**
 * REA-270 - OnDemandOrderForm tests
 * AddressManager mock properly captures both onAddressesLoaded and onAddressSelected callbacks
 * for both pickup and delivery address managers using showManagementButtons prop.
 */
describe("OnDemandOrderForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    // Reset address manager callback state
    addressSelectCallbacks.pickup = undefined;
    addressSelectCallbacks.delivery = undefined;
    addressLoadCallbacks.pickup = undefined;
    addressLoadCallbacks.delivery = undefined;

    // Default mock for useUser
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

    // Wait for form to initialize and Supabase client + user to be loaded
    await waitForInit();
    await waitForInit();

    // Simulate address loading (populates component's addresses state)
    await act(async () => {
      addressLoadCallbacks.pickup?.([mockAddress]);
      addressLoadCallbacks.delivery?.([mockAddress]);
    });
    await waitForInit();

    // Fill out the form with valid data
    // Fill brokerage/direct field
    const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
    await user.selectOptions(brokerageSelect, "direct");

    // Fill order number
    await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

    // Fill date
    const dateInput = screen.getByLabelText(/date/i);
    await user.clear(dateInput);
    await user.type(dateInput, "2024-12-31");

    // Fill pickup time
    await user.type(screen.getByLabelText(/pickup time/i), "10:00");

    // Fill arrival time
    await user.type(screen.getByLabelText(/arrival time/i), "11:00");

    // Fill client attention
    await user.type(screen.getByLabelText(/client attention/i), "John Doe");

    // Fill item being delivered
    await user.type(screen.getByLabelText(/item.*delivered/i), "Test Package");

    // Fill vehicle type
    const vehicleSelect = screen.getByLabelText(/vehicle type/i);
    await user.selectOptions(vehicleSelect, "Car");

    // Fill order total
    await user.type(screen.getByLabelText(/order total/i), "100");

    // Simulate address selection (calls component's onAddressSelected with ID)
    await act(async () => {
      addressSelectCallbacks.pickup?.(mockAddress.id);
      addressSelectCallbacks.delivery?.(mockAddress.id);
    });
    await waitForInit();

    // Submit the form using fireEvent.submit (more reliable than button click in tests)
    const submitButton = screen.getByRole("button", {
      name: /submit.*request/i,
    });
    const form = submitButton.closest('form');

    await act(async () => {
      if (form) {
        fireEvent.submit(form);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Wait for fetch to be called, then check redirect
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/client");
    }, { timeout: 5000 });
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

    // Wait for form to initialize and Supabase client + user to be loaded
    await waitForInit();
    await waitForInit();

    // Simulate address loading (populates component's addresses state)
    await act(async () => {
      addressLoadCallbacks.pickup?.([mockAddress]);
      addressLoadCallbacks.delivery?.([mockAddress]);
    });
    await waitForInit();

    // Fill out the form with valid data
    // Fill brokerage/direct field
    const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
    await user.selectOptions(brokerageSelect, "direct");

    // Fill order number
    await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

    // Fill date
    const dateInput = screen.getByLabelText(/date/i);
    await user.clear(dateInput);
    await user.type(dateInput, "2024-12-31");

    // Fill pickup time
    await user.type(screen.getByLabelText(/pickup time/i), "10:00");

    // Fill arrival time
    await user.type(screen.getByLabelText(/arrival time/i), "11:00");

    // Fill client attention
    await user.type(screen.getByLabelText(/client attention/i), "John Doe");

    // Fill item being delivered
    await user.type(screen.getByLabelText(/item.*delivered/i), "Test Package");

    // Fill vehicle type
    const vehicleSelect = screen.getByLabelText(/vehicle type/i);
    await user.selectOptions(vehicleSelect, "Car");

    // Fill order total
    await user.type(screen.getByLabelText(/order total/i), "100");

    // Simulate address selection (calls component's onAddressSelected with ID)
    await act(async () => {
      addressSelectCallbacks.pickup?.(mockAddress.id);
      addressSelectCallbacks.delivery?.(mockAddress.id);
    });
    await waitForInit();

    // Submit the form using fireEvent.submit (more reliable than button click in tests)
    const submitButton = screen.getByRole("button", {
      name: /submit.*request/i,
    });
    const form = submitButton.closest('form');

    await act(async () => {
      if (form) {
        fireEvent.submit(form);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Wait for fetch to be called, then check redirect
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    }, { timeout: 5000 });

    // Verify that router.push was called
    // Note: Both vendors and clients redirect to /client per getDashboardRouteByRole utility
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/client");
    }, { timeout: 5000 });
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

    // Wait for form to initialize (Supabase client and user)
    await waitFor(() => {
      expect(screen.getByLabelText(/brokerage.*direct/i)).toBeEnabled();
    });

    // Simulate address loading (populates component's addresses state)
    await act(async () => {
      addressLoadCallbacks.pickup?.([mockAddress]);
      addressLoadCallbacks.delivery?.([mockAddress]);
    });

    // Fill out the form with valid data
    await act(async () => {
      const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
      await user.selectOptions(brokerageSelect, "direct");
      await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

      // Fill date
      const dateInput = screen.getByLabelText(/date/i);
      await user.clear(dateInput);
      await user.type(dateInput, "2024-12-31");

      // Fill pickup time
      await user.type(screen.getByLabelText(/pickup time/i), "10:00");

      // Fill arrival time
      await user.type(screen.getByLabelText(/arrival time/i), "11:00");

      // Fill client attention
      await user.type(screen.getByLabelText(/client attention/i), "John Doe");

      // Fill item being delivered
      await user.type(screen.getByLabelText(/item.*delivered/i), "Test Package");

      // Fill vehicle type
      const vehicleSelect = screen.getByLabelText(/vehicle type/i);
      await user.selectOptions(vehicleSelect, "Car");

      // Fill order total
      await user.type(screen.getByLabelText(/order total/i), "100");

      // Simulate address selection
      addressSelectCallbacks.pickup?.(mockAddress.id);
      addressSelectCallbacks.delivery?.(mockAddress.id);
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

  it("posts a body that POST /api/orders accepts as an on-demand order", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<OnDemandOrderForm />);
    });

    await waitForInit();
    await waitForInit();

    // Both AddressManagers share the same loaded address list
    await act(async () => {
      addressLoadCallbacks.pickup?.([mockAddress, mockDeliveryAddress]);
      addressLoadCallbacks.delivery?.([mockAddress, mockDeliveryAddress]);
    });
    await waitForInit();

    await user.selectOptions(screen.getByLabelText(/brokerage.*direct/i), "direct");
    await user.type(screen.getByLabelText(/order number/i), "TEST-12345");
    const dateInput = screen.getByLabelText(/date/i);
    await user.clear(dateInput);
    await user.type(dateInput, "2024-12-31");
    await user.type(screen.getByLabelText(/pickup time/i), "10:00");
    await user.type(screen.getByLabelText(/arrival time/i), "11:00");
    await user.type(screen.getByLabelText(/client attention/i), "John Doe");
    await user.type(screen.getByLabelText(/item.*delivered/i), "Test Package");
    await user.selectOptions(screen.getByLabelText(/vehicle type/i), "Van");
    await user.type(screen.getByLabelText(/order total/i), "100");
    await user.type(screen.getByLabelText(/^tip/i), "5");
    await user.type(screen.getByLabelText(/pickup notes/i), "Ring the bell");

    await act(async () => {
      addressSelectCallbacks.pickup?.(mockAddress.id);
      addressSelectCallbacks.delivery?.(mockDeliveryAddress.id);
    });
    await waitForInit();

    const form = screen.getByRole("button", { name: /submit.*request/i }).closest("form");
    await act(async () => {
      if (form) fireEvent.submit(form);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/orders",
        expect.objectContaining({ method: "POST" }),
      );
    }, { timeout: 5000 });

    const [, options] = mockFetch.mock.calls.find(
      ([url, init]) => url === "/api/orders" && init?.method === "POST",
    )!;
    const body = JSON.parse(options.body);

    // The route's strict allowlist must accept the body as-is.
    const parsed = parseCreateOrderBody(body);
    expect(parsed).toMatchObject({ success: true, type: "ondemand" });

    expect(body).toEqual({
      type: "ondemand",
      pickupAddressId: mockAddress.id,
      deliveryAddressId: mockDeliveryAddress.id,
      pickupDateTime: localTimeToUtc("2024-12-31", "10:00"),
      arrivalDateTime: localTimeToUtc("2024-12-31", "11:00"),
      clientAttention: "John Doe",
      itemDelivered: "Test Package",
      vehicleType: "VAN",
      orderTotal: 100,
      tip: 5,
      pickupNotes: "Ring the bell",
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/client");
    }, { timeout: 5000 });
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

describe("OnDemandOrderForm — native-picker-input class", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  it("applies native-picker-input to date and time fields but not text fields", async () => {
    await act(async () => {
      render(<OnDemandOrderForm />);
    });

    // Date and time fields should have the class
    expect(screen.getByLabelText(/^date/i)).toHaveClass("native-picker-input");
    expect(screen.getByLabelText(/pickup time/i)).toHaveClass("native-picker-input");
    expect(screen.getByLabelText(/arrival time/i)).toHaveClass("native-picker-input");

    // Text fields should NOT have the class
    expect(screen.getByLabelText(/order number/i)).not.toHaveClass("native-picker-input");
  });
});
