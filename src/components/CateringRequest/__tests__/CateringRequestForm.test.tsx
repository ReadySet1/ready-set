import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
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

// Mock AddressSelector component (CateringRequestForm uses AddressSelector, not AddressManager)
const mockHandleAddressSelect = jest.fn();
jest.mock("@/components/AddressSelector", () => {
  const MockSelector = (props: { onSelect: (address: any) => void }) => {
    mockHandleAddressSelect.mockImplementation(props.onSelect);
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

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: "test-user-id",
              email: "test@example.com",
              app_metadata: { role: "vendor" },
            },
          },
        },
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

describe("CateringRequestForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockHandleAddressSelect.mockClear();

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

  // TODO: REA-268 - Form submission now shows OrderConfirmationModal first, redirect happens on modal close
  // These tests need to be updated to handle modal interaction
  it.skip("redirects to client dashboard for client users after successful form submission", async () => {
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

    // Fill out the form with valid data
    await act(async () => {
      // Fill brokerage field
      const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
      await user.selectOptions(brokerageSelect, "Ez Cater");

      // Fill order number
      await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

      // Fill date
      await user.type(screen.getByLabelText(/date/i), "2024-12-31");

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

      // Simulate address selection
      mockHandleAddressSelect(mockAddress);
    });

    // Submit the form
    await act(async () => {
      const submitButton = screen.getByRole("button", {
        name: /submit catering request/i,
      });
      await user.click(submitButton);
    });

    // Verify that router.push was called with the client dashboard path for client users
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/client");
    });
  });

  // TODO: REA-268 - Form submission now shows OrderConfirmationModal first, redirect happens on modal close
  it.skip("redirects to vendor dashboard for vendor users after successful form submission", async () => {
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

    // Fill out the form with valid data
    await act(async () => {
      // Fill brokerage field
      const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
      await user.selectOptions(brokerageSelect, "Ez Cater");

      // Fill order number
      await user.type(screen.getByLabelText(/order number/i), "TEST-12345");

      // Fill date
      await user.type(screen.getByLabelText(/date/i), "2024-12-31");

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
      const hostNoRadio = screen.getByRole("button", { name: /no/i });
      await user.click(hostNoRadio);

      // Simulate address selection
      mockHandleAddressSelect(mockAddress);
    });

    // Submit the form
    await act(async () => {
      const submitButton = screen.getByRole("button", {
        name: /submit catering request/i,
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

    // Fill out the form with valid data
    await act(async () => {
      const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
      await user.selectOptions(brokerageSelect, "Ez Cater");
      await user.type(screen.getByLabelText(/order number/i), "TEST-12345");
      await user.type(screen.getByLabelText(/date/i), "2024-12-31");
      await user.type(screen.getByLabelText(/headcount/i), "50");
      await user.type(screen.getByLabelText(/pick up time/i), "10:00");
      await user.type(screen.getByLabelText(/arrival time/i), "11:00");
      await user.type(screen.getByLabelText(/client.*attention/i), "John Doe");
      await user.type(screen.getByLabelText(/order total/i), "1000");

      const hostNoRadio = screen.getByRole("radio", { name: /no/i });
      await user.click(hostNoRadio);

      mockHandleAddressSelect(mockAddress);
    });

    // Submit the form
    await act(async () => {
      const submitButton = screen.getByRole("button", {
        name: /submit catering request/i,
      });
      await user.click(submitButton);
    });

    // Verify that router.push was NOT called since submission failed
    await waitFor(() => {
      // Wait a moment to ensure no redirect happened
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  // TODO: REA-268 - Form submission now shows OrderConfirmationModal first, redirect happens on modal close
  it.skip("submits the form with correct data structure", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<CateringRequestForm />);
    });

    // Fill out the form
    await act(async () => {
      const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
      await user.selectOptions(brokerageSelect, "Ez Cater");
      await user.type(screen.getByLabelText(/order number/i), "TEST-12345");
      await user.type(screen.getByLabelText(/date/i), "2024-12-31");
      await user.type(screen.getByLabelText(/headcount/i), "50");
      await user.type(screen.getByLabelText(/pick up time/i), "10:00");
      await user.type(screen.getByLabelText(/arrival time/i), "11:00");
      await user.type(screen.getByLabelText(/client.*attention/i), "John Doe");
      await user.type(screen.getByLabelText(/order total/i), "1000");

      const hostNoRadio = screen.getByRole("radio", { name: /no/i });
      await user.click(hostNoRadio);

      mockHandleAddressSelect(mockAddress);

      const submitButton = screen.getByRole("button", {
        name: /submit catering request/i,
      });
      await user.click(submitButton);
    });

    // Verify the API call was made with correct data
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/catering-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("TEST-12345"),
      });

      // Verify redirect happened
      expect(mockPush).toHaveBeenCalledWith("/client");
    });
  });

  // TODO: REA-268 - "Manage Addresses Button" feature was removed from component
  // Skip these tests as the UI element no longer exists
  describe.skip("Manage Addresses Button", () => {
    it("renders the Manage Addresses button in the delivery details section", async () => {
      await act(async () => {
        render(<CateringRequestForm />);
      });

      // Check that the Delivery Details section is rendered
      expect(screen.getByText(/delivery details/i)).toBeInTheDocument();

      // Check that the Manage Addresses button is rendered
      const manageAddressesButton = screen.getByRole("link", {
        name: /manage addresses/i,
      });
      expect(manageAddressesButton).toBeInTheDocument();
    });

    it("has the correct href attribute pointing to /addresses", async () => {
      await act(async () => {
        render(<CateringRequestForm />);
      });

      const manageAddressesButton = screen.getByRole("link", {
        name: /manage addresses/i,
      });
      expect(manageAddressesButton).toHaveAttribute("href", "/addresses");
    });

    it("has the correct styling classes", async () => {
      await act(async () => {
        render(<CateringRequestForm />);
      });

      const manageAddressesButton = screen.getByRole("link", {
        name: /manage addresses/i,
      });

      // Check for the expected CSS classes
      expect(manageAddressesButton).toHaveClass(
        "rounded-md",
        "bg-blue-500",
        "px-4",
        "py-2",
        "text-white",
        "transition",
        "hover:bg-blue-600",
      );
    });

    it("is accessible and properly labeled", async () => {
      await act(async () => {
        render(<CateringRequestForm />);
      });

      const manageAddressesButton = screen.getByRole("link", {
        name: /manage addresses/i,
      });

      // Check that the button is accessible
      expect(manageAddressesButton).toBeVisible();
      expect(manageAddressesButton).not.toHaveAttribute("aria-disabled");

      // Check that it has proper focus styles
      expect(manageAddressesButton).toHaveClass(
        "focus:outline-none",
        "focus:ring-2",
        "focus:ring-blue-500",
        "focus:ring-offset-2",
      );
    });

    it("is positioned correctly within the delivery details section", async () => {
      await act(async () => {
        render(<CateringRequestForm />);
      });

      // Find the delivery details section
      const deliveryDetailsSection = screen
        .getByText(/delivery details/i)
        .closest("div");
      expect(deliveryDetailsSection).toBeInTheDocument();

      // Check that the Manage Addresses button is within the delivery details section
      const manageAddressesButton = screen.getByRole("link", {
        name: /manage addresses/i,
      });

      // The button should be a descendant of the delivery details section
      expect(deliveryDetailsSection).toContainElement(manageAddressesButton);
    });

    it("does not interfere with form submission", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<CateringRequestForm />);
      });

      // First, verify the button is there
      const manageAddressesButton = screen.getByRole("link", {
        name: /manage addresses/i,
      });
      expect(manageAddressesButton).toBeInTheDocument();

      // Fill out the form and submit (similar to existing tests)
      await act(async () => {
        const brokerageSelect = screen.getByLabelText(/brokerage.*direct/i);
        await user.selectOptions(brokerageSelect, "Ez Cater");
        await user.type(screen.getByLabelText(/order number/i), "TEST-12345");
        await user.type(screen.getByLabelText(/date/i), "2024-12-31");
        await user.type(screen.getByLabelText(/headcount/i), "50");
        await user.type(screen.getByLabelText(/pick up time/i), "10:00");
        await user.type(screen.getByLabelText(/arrival time/i), "11:00");
        await user.type(
          screen.getByLabelText(/client.*attention/i),
          "John Doe",
        );
        await user.type(screen.getByLabelText(/order total/i), "1000");

        const hostNoRadio = screen.getByRole("radio", { name: /no/i });
        await user.click(hostNoRadio);

        mockHandleAddressSelect(mockAddress);
      });

      // Submit the form
      await act(async () => {
        const submitButton = screen.getByRole("button", {
          name: /submit catering request/i,
        });
        await user.click(submitButton);
      });

      // Verify that form submission still works normally
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/catering-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("TEST-12345"),
        });
        expect(mockPush).toHaveBeenCalledWith("/client");
      });
    });
  });
});
