import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CateringRequestForm from "../CateringRequestForm";
import { Address } from "@/types/address";
import { vi } from "vitest";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
const mockSupabase = {} as SupabaseClient;
const mockSession = {} as Session;

// Mock Next.js router
const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock AddressManager component
const mockHandleAddressSelect = vi.fn();
vi.mock("@/components/AddressManager", () => ({
  __esModule: true,
  default: (props: { onAddressSelected: (address: any) => void }) => {
    mockHandleAddressSelect.mockImplementation(props.onAddressSelected);
    return <div data-testid="mock-address-manager">Mock Address Manager</div>;
  },
}));

// Mock file upload hook
vi.mock("@/hooks/use-job-application-upload", () => ({
  useJobApplicationUpload: () => ({
    uploadedFiles: [],
    deleteFile: vi.fn(),
    uploadFile: vi.fn(),
    isUploading: false,
    updateEntityId: vi.fn(),
  }),
}));

// Mock Supabase client
vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
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
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  })),
}));

// Mock fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock scrollIntoView for JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock ResizeObserver for JSDOM
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

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
    vi.clearAllMocks();
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
      render(<CateringRequestForm supabase={mockSupabase} session={mockSession} />);
    });

    // Check that key form elements are rendered
    expect(screen.getByTestId("mock-address-manager")).toBeInTheDocument();
    expect(screen.getByLabelText(/brokerage.*direct/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/order number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/headcount/i)).toBeInTheDocument();
  });

  it("redirects to vendor dashboard after successful form submission", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<CateringRequestForm supabase={mockSupabase} session={mockSession} />);
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
      render(<CateringRequestForm supabase={mockSupabase} session={mockSession} />);
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

  it("submits the form with correct data structure", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<CateringRequestForm supabase={mockSupabase} session={mockSession} />);
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
      expect(mockPush).toHaveBeenCalledWith("/vendor");
    });
  });

  describe("Manage Addresses Button", () => {
    it("renders the Manage Addresses button in the delivery details section", async () => {
      await act(async () => {
        render(<CateringRequestForm supabase={mockSupabase} session={mockSession} />);
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
        render(<CateringRequestForm supabase={mockSupabase} session={mockSession} />);
      });

      const manageAddressesButton = screen.getByRole("link", {
        name: /manage addresses/i,
      });
      expect(manageAddressesButton).toHaveAttribute("href", "/addresses");
    });

    it("has the correct styling classes", async () => {
      await act(async () => {
        render(<CateringRequestForm supabase={mockSupabase} session={mockSession} />);
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
        render(<CateringRequestForm supabase={mockSupabase} session={mockSession} />);
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
        render(<CateringRequestForm supabase={mockSupabase} session={mockSession} />);
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
        render(<CateringRequestForm supabase={mockSupabase} session={mockSession} />);
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
        expect(mockPush).toHaveBeenCalledWith("/vendor");
      });
    });
  });
});
