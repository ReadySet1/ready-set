import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";

// Mock Next.js navigation hooks
const mockPush = jest.fn();
const mockPathname = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
  useParams: () => ({ order_number: "OD-12345" }),
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => ({
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: jest.fn().mockResolvedValue({
      data: { session: { access_token: "mock-token" } },
      error: null,
    }),
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    }),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({
          data: { type: "admin" },
          error: null,
        }),
      })),
    })),
  })),
  storage: {
    listBuckets: jest.fn().mockResolvedValue({
      data: [{ name: "user-assets" }],
      error: null,
    }),
  },
};

jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Mock broker sync service
jest.mock("@/lib/services/brokerSyncService", () => ({
  syncOrderStatusWithBroker: jest.fn().mockResolvedValue(undefined),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe("OnDemand Driver Assignment Functionality", () => {
  const mockOrder = {
    id: "ondemand-123-456-789",
    orderNumber: "OD-12345",
    status: "ACTIVE",
    order_type: "on_demand",
    orderTotal: 150.0,
    pickupDateTime: "2025-09-25T14:00:00Z",
    arrivalDateTime: null,
    completeDateTime: null,
    createdAt: "2025-09-23T11:00:00Z",
    updatedAt: "2025-09-23T11:00:00Z",
    userId: "9e5b3515-4e8b-4c6b-a9fc-f9388548a7dd",
    dispatches: [],
  };

  const mockDrivers = [
    {
      id: "driver-123-456-789",
      name: "Maria Rodriguez",
      email: "maria.rodriguez@example.com",
      contactNumber: "5559876543",
    },
    {
      id: "driver-987-654-321",
      name: "Carlos Mendez",
      email: "carlos.mendez@example.com",
      contactNumber: "5554567890",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/order-status/OD-12345");

    // Setup default successful responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/orders/OD-12345?include=dispatch.driver")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOrder),
        });
      }

      if (url.includes("/api/orders/OD-12345/files")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }

      if (url.includes("/api/drivers")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDrivers),
        });
      }

      if (url.includes("/api/orders/assignDriver")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              updatedOrder: { ...mockOrder, status: "ASSIGNED" },
              dispatch: {
                id: "dispatch-ondemand-123",
                driverId: "driver-123-456-789",
                driver: mockDrivers[0],
              },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("OnDemand Driver Assignment Flow", () => {
    it("should successfully assign a driver to on-demand order", async () => {
      const { default: SingleOnDemandOrder } = await import(
        "@/components/Orders/OnDemand/SingleOnDemandOrder"
      );

      await act(async () => {
        render(<SingleOnDemandOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      // Wait for drivers to load and select one
      await waitFor(() => {
        expect(screen.getByText("Maria Rodriguez")).toBeInTheDocument();
        expect(screen.getByText("Carlos Mendez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      await userEvent.click(driverSelectButton);

      // Wait for driver to be selected
      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
      });

      // Click Assign Driver button in dialog
      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      await userEvent.click(assignDriverButton);

      // Verify API call was made with correct order type
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/orders/assignDriver",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              Authorization: "Bearer mock-token",
            }),
            body: JSON.stringify({
              orderId: "ondemand-123-456-789",
              driverId: "driver-123-456-789",
              orderType: "on_demand",
            }),
          }),
        );
      });

      // Verify success toast is shown
      expect(toast.success).toHaveBeenCalledWith(
        "Driver assigned successfully!",
      );

      // Verify dialog closes
      await waitFor(() => {
        expect(
          screen.queryByText("Select a driver to assign to this order."),
        ).not.toBeInTheDocument();
      });
    });

    it("should display driver information after successful assignment", async () => {
      // Mock order with driver already assigned
      const orderWithDriver = {
        ...mockOrder,
        dispatches: [
          {
            id: "dispatch-ondemand-123",
            driverId: "driver-123-456-789",
            driver: mockDrivers[0],
          },
        ],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/orders/OD-12345?include=dispatch.driver")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(orderWithDriver),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      const { default: SingleOnDemandOrder } = await import(
        "@/components/Orders/OnDemand/SingleOnDemandOrder"
      );

      await act(async () => {
        render(<SingleOnDemandOrder onDeleteSuccess={() => {}} />);
      });

      // Wait for driver info to be displayed
      await waitFor(() => {
        expect(screen.getByText("Maria Rodriguez")).toBeInTheDocument();
        expect(
          screen.getByText("maria.rodriguez@example.com"),
        ).toBeInTheDocument();
        expect(screen.getByText("5559876543")).toBeInTheDocument();
      });
    });

    it("should show Update Driver button when driver is already assigned", async () => {
      // Mock order with driver already assigned
      const orderWithDriver = {
        ...mockOrder,
        dispatches: [
          {
            id: "dispatch-ondemand-123",
            driverId: "driver-123-456-789",
            driver: mockDrivers[0],
          },
        ],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/orders/OD-12345?include=dispatch.driver")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(orderWithDriver),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      });

      const { default: SingleOnDemandOrder } = await import(
        "@/components/Orders/OnDemand/SingleOnDemandOrder"
      );

      await act(async () => {
        render(<SingleOnDemandOrder onDeleteSuccess={() => {}} />);
      });

      // Wait for Update Driver button to appear
      await waitFor(() => {
        expect(screen.getByText("Update Driver")).toBeInTheDocument();
      });
    });

    it("should handle driver assignment API errors for on-demand orders", async () => {
      // Mock API error
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/orders/assignDriver")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () =>
              Promise.resolve({ error: "Database connection failed" }),
          });
        }
        // Return successful responses for other calls
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOrder),
        });
      });

      const { default: SingleOnDemandOrder } = await import(
        "@/components/Orders/OnDemand/SingleOnDemandOrder"
      );

      await act(async () => {
        render(<SingleOnDemandOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog and select driver
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      await waitFor(() => {
        expect(screen.getByText("Maria Rodriguez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      await userEvent.click(driverSelectButton);

      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
      });

      // Click Assign Driver button
      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      await userEvent.click(assignDriverButton);

      // Verify error toast is shown
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to assign/edit driver: Failed to assign/edit driver: Database connection failed",
        );
      });
    });

    it("should maintain dialog state correctly during assignment process", async () => {
      const { default: SingleOnDemandOrder } = await import(
        "@/components/Orders/OnDemand/SingleOnDemandOrder"
      );

      await act(async () => {
        render(<SingleOnDemandOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      // Wait for dialog to open
      await waitFor(() => {
        expect(
          screen.getByText("Select a driver to assign to this order."),
        ).toBeInTheDocument();
      });

      // Select a driver
      await waitFor(() => {
        expect(screen.getByText("Maria Rodriguez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      await userEvent.click(driverSelectButton);

      // Verify driver is selected and button is enabled
      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
        const assignDriverButton = screen.getByRole("button", {
          name: /assign driver/i,
        });
        expect(assignDriverButton).not.toBeDisabled();
      });

      // Complete assignment
      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      await userEvent.click(assignDriverButton);

      // Verify dialog closes after successful assignment
      await waitFor(() => {
        expect(
          screen.queryByText("Select a driver to assign to this order."),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("OnDemand Order Type Specific Tests", () => {
    it("should use correct order type in API calls", async () => {
      const { default: SingleOnDemandOrder } = await import(
        "@/components/Orders/OnDemand/SingleOnDemandOrder"
      );

      await act(async () => {
        render(<SingleOnDemandOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog and assign driver
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      await waitFor(() => {
        expect(screen.getByText("Maria Rodriguez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      await userEvent.click(driverSelectButton);

      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
      });

      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      await userEvent.click(assignDriverButton);

      // Verify the API call includes the correct order type
      await waitFor(() => {
        const assignDriverCall = mockFetch.mock.calls.find((call) =>
          call[0].includes("/api/orders/assignDriver"),
        );

        expect(assignDriverCall).toBeDefined();

        const requestBody = JSON.parse(assignDriverCall![1].body as string);
        expect(requestBody.orderType).toBe("on_demand");
        expect(requestBody.orderId).toBe("ondemand-123-456-789");
      });
    });

    it("should handle on-demand order specific error scenarios", async () => {
      // Mock specific on-demand order error
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/orders/assignDriver")) {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () =>
              Promise.resolve({
                error: "On-demand order not found or invalid status",
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOrder),
        });
      });

      const { default: SingleOnDemandOrder } = await import(
        "@/components/Orders/OnDemand/SingleOnDemandOrder"
      );

      await act(async () => {
        render(<SingleOnDemandOrder onDeleteSuccess={() => {}} />);
      });

      // Attempt driver assignment
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      await waitFor(() => {
        expect(screen.getByText("Maria Rodriguez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      await userEvent.click(driverSelectButton);

      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
      });

      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      await userEvent.click(assignDriverButton);

      // Verify specific error handling
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to assign/edit driver: Failed to assign/edit driver: On-demand order not found or invalid status",
        );
      });
    });
  });
});
