import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
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
  useParams: () => ({ order_number: "SF-56780" }),
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

describe("Driver Assignment - Quick Test", () => {
  const mockOrder = {
    id: "6b5c977d-ee51-411a-a695-8c95d88735df",
    orderNumber: "SF-56780",
    status: "ACTIVE",
    order_type: "catering",
    orderTotal: 250.0,
    pickupDateTime: "2025-09-25T12:00:00Z",
    arrivalDateTime: null,
    completeDateTime: null,
    createdAt: "2025-09-23T10:00:00Z",
    updatedAt: "2025-09-23T10:00:00Z",
    userId: "9e5b3515-4e8b-4c6b-a9fc-f9388548a7dd",
    dispatches: [],
  };

  const mockDrivers = [
    {
      id: "d2e6f3ef-d801-4dd0-b840-c8de7754a6bd",
      name: "David Sanchez",
      email: "davids2002@gmail.com",
      contactNumber: "4792608514",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/order-status/SF-56780");

    // Setup default successful responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/orders/SF-56780?include=dispatch.driver")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOrder),
        });
      }

      if (url.includes("/api/orders/SF-56780/files")) {
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
                id: "dispatch-123",
                driverId: "d2e6f3ef-d801-4dd0-b840-c8de7754a6bd",
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

  it("should successfully assign a driver and close dialog", async () => {
    const { default: SingleOrder } = await import(
      "@/components/Orders/SingleOrder"
    );

    await act(async () => {
      render(<SingleOrder onDeleteSuccess={() => {}} />);
    });

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText("Assign Driver")).toBeInTheDocument();
    });

    // Click Assign Driver button
    const assignButton = screen.getByText("Assign Driver");
    await userEvent.click(assignButton);

    // Wait for dialog to open
    await waitFor(() => {
      expect(
        screen.getByText("Select a driver to assign to this order."),
      ).toBeInTheDocument();
    });

    // Wait for drivers to load and select one
    await waitFor(() => {
      expect(screen.getByText("David Sanchez")).toBeInTheDocument();
    });

    const driverSelectButton = screen.getByText("Select");
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

    // Verify API call was made
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
            orderId: "6b5c977d-ee51-411a-a695-8c95d88735df",
            driverId: "d2e6f3ef-d801-4dd0-b840-c8de7754a6bd",
            orderType: "catering",
          }),
        }),
      );
    });

    // Verify success toast is shown
    expect(toast.success).toHaveBeenCalledWith("Driver assigned successfully!");

    // Verify dialog closes
    await waitFor(() => {
      expect(
        screen.queryByText("Select a driver to assign to this order."),
      ).not.toBeInTheDocument();
    });
  }, 10000); // 10 second timeout
});
