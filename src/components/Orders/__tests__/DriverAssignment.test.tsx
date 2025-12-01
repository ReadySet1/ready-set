import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { UserType } from "@/types/user";

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

// TODO: Fix test isolation and timeout issues - all tests hang for 30+ seconds
describe.skip("Driver Assignment Functionality", () => {
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
    {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "John Doe",
      email: "john.doe@example.com",
      contactNumber: "5551234567",
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

  afterEach(() => {
    cleanup(); // Clean up React components
    jest.restoreAllMocks();
    jest.clearAllTimers(); // Clear any pending timers
    // Force garbage collection hint
    if (global.gc) {
      global.gc();
    }
  });

  describe("Driver Assignment Dialog", () => {
    it("should open driver assignment dialog when Assign Driver button is clicked", async () => {
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

      // Check if dialog opens
      await waitFor(() => {
        expect(
          screen.getByText("Select a driver to assign to this order."),
        ).toBeInTheDocument();
      });
    });

    it("should display available drivers in the dialog", async () => {
      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      // Check if drivers are displayed
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });
    });

    it("should allow driver selection", async () => {
      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      // Wait for drivers to load
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
      });

      // Click on first driver
      const driverSelectButton = screen.getAllByText("Select")[0];
      expect(driverSelectButton).toBeInTheDocument();
      await userEvent.click(driverSelectButton!);

      // Check if driver is selected
      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
      });
    });

    it("should close dialog when Cancel button is clicked", async () => {
      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
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

      // Click Cancel button
      const cancelButton = screen.getByText("Cancel");
      await userEvent.click(cancelButton);

      // Check if dialog closes
      await waitFor(() => {
        expect(
          screen.queryByText("Select a driver to assign to this order."),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Driver Assignment Flow", () => {
    it("should successfully assign a driver and close dialog", async () => {
      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      // Wait for drivers to load and select one
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      expect(driverSelectButton).toBeInTheDocument();
      await userEvent.click(driverSelectButton!);

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

    it("should handle driver assignment API errors gracefully", async () => {
      // Mock API error
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/orders/assignDriver")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: "Internal server error" }),
          });
        }
        // Return successful responses for other calls
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOrder),
        });
      });

      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog and select driver
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      expect(driverSelectButton).toBeInTheDocument();
      await userEvent.click(driverSelectButton!);

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
          "Failed to assign/edit driver: Failed to assign/edit driver: Internal server error",
        );
      });
    });

    it("should disable Assign Driver button when no driver is selected", async () => {
      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
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

      // Check that Assign Driver button is disabled
      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      expect(assignDriverButton).toBeDisabled();
    });

    it("should enable Assign Driver button when a driver is selected", async () => {
      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      // Wait for drivers to load
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
      });

      // Select a driver
      const driverSelectButton = screen.getAllByText("Select")[0];
      expect(driverSelectButton).toBeInTheDocument();
      await userEvent.click(driverSelectButton!);

      // Wait for driver to be selected
      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
      });

      // Check that Assign Driver button is now enabled
      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      expect(assignDriverButton).not.toBeDisabled();
    });
  });

  describe("Driver Information Display", () => {
    it("should display driver information after successful assignment", async () => {
      // Mock order with driver already assigned
      const orderWithDriver = {
        ...mockOrder,
        dispatches: [
          {
            id: "dispatch-123",
            driverId: "d2e6f3ef-d801-4dd0-b840-c8de7754a6bd",
            driver: mockDrivers[0],
          },
        ],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/orders/SF-56780?include=dispatch.driver")) {
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

      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Wait for driver info to be displayed
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
        expect(screen.getByText("davids2002@gmail.com")).toBeInTheDocument();
        expect(screen.getByText("4792608514")).toBeInTheDocument();
      });
    });

    it("should show Update Driver button when driver is already assigned", async () => {
      // Mock order with driver already assigned
      const orderWithDriver = {
        ...mockOrder,
        dispatches: [
          {
            id: "dispatch-123",
            driverId: "d2e6f3ef-d801-4dd0-b840-c8de7754a6bd",
            driver: mockDrivers[0],
          },
        ],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/orders/SF-56780?include=dispatch.driver")) {
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

      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Wait for Update Driver button to appear
      await waitFor(() => {
        expect(screen.getByText("Update Driver")).toBeInTheDocument();
      });
    });
  });

  describe("Search Functionality", () => {
    it("should filter drivers by name", async () => {
      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      // Wait for drivers to load
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Search for "David"
      const searchInput = screen.getByPlaceholderText(
        "Search drivers by name or phone...",
      );
      await userEvent.type(searchInput, "David");

      // Check that only David Sanchez is shown
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
        expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      });
    });

    it("should filter drivers by phone number", async () => {
      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      // Wait for drivers to load
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Search for phone number
      const searchInput = screen.getByPlaceholderText(
        "Search drivers by name or phone...",
      );
      await userEvent.type(searchInput, "4792608514");

      // Check that only David Sanchez is shown
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
        expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
      });
    });

    it("should show no results message when search yields no matches", async () => {
      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      // Wait for drivers to load
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
      });

      // Search for non-existent driver
      const searchInput = screen.getByPlaceholderText(
        "Search drivers by name or phone...",
      );
      await userEvent.type(searchInput, "NonExistentDriver");

      // Check that no results message is shown
      await waitFor(() => {
        expect(screen.getByText("No drivers found")).toBeInTheDocument();
        expect(
          screen.getByText(
            'No drivers match "NonExistentDriver". Try a different search term.',
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Role-Based Driver Assignment Tests", () => {
    it("should allow admin users to assign drivers", async () => {
      // Mock admin user session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: { access_token: "admin-token", user: { id: "admin-user" } },
        },
        error: null,
      });

      // Mock admin role check
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { type: UserType.ADMIN },
              error: null,
            }),
          })),
        })),
      });

      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      // Wait for component to load with admin permissions
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      // Verify dialog opens
      await waitFor(() => {
        expect(
          screen.getByText("Select a driver to assign to this order."),
        ).toBeInTheDocument();
      });

      // Select driver
      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      await userEvent.click(driverSelectButton!);

      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
      });

      // Complete assignment
      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      await userEvent.click(assignDriverButton);

      // Verify API call was made with correct authorization
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/orders/assignDriver",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer admin-token",
            }),
          }),
        );
      });
    });

    it("should allow super admin users to assign drivers", async () => {
      // Mock super admin user session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            access_token: "super-admin-token",
            user: { id: "super-admin-user" },
          },
        },
        error: null,
      });

      // Mock super admin role check
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { type: UserType.SUPER_ADMIN },
              error: null,
            }),
          })),
        })),
      });

      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      await waitFor(() => {
        expect(
          screen.getByText("Select a driver to assign to this order."),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      await userEvent.click(driverSelectButton!);

      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
      });

      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      await userEvent.click(assignDriverButton);

      // Verify API call was made with super admin authorization
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/orders/assignDriver",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer super-admin-token",
            }),
          }),
        );
      });
    });

    it("should prevent regular users from accessing driver assignment", async () => {
      // Mock regular user session (non-admin)
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: { access_token: "user-token", user: { id: "regular-user" } },
        },
        error: null,
      });

      // Mock regular user role check
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { type: UserType.CLIENT },
              error: null,
            }),
          })),
        })),
      });

      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={false} />,
        );
      });

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Driver & Status")).toBeInTheDocument();
      });

      // Verify Assign Driver button is not visible for regular users
      expect(screen.queryByText("Assign Driver")).not.toBeInTheDocument();
      expect(screen.queryByText("Update Driver")).not.toBeInTheDocument();
    });

    it("should allow updating driver assignment for admin users", async () => {
      // Mock order with existing driver assignment
      const orderWithDriver = {
        ...mockOrder,
        dispatches: [
          {
            id: "dispatch-123",
            driverId: "d2e6f3ef-d801-4dd0-b840-c8de7754a6bd",
            driver: mockDrivers[0],
          },
        ],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/orders/SF-56780?include=dispatch.driver")) {
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

      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      // Wait for Update Driver button to appear
      await waitFor(() => {
        expect(screen.getByText("Update Driver")).toBeInTheDocument();
      });

      const updateButton = screen.getByText("Update Driver");
      await userEvent.click(updateButton);

      // Verify dialog opens with update title
      await waitFor(() => {
        expect(
          screen.getByText("Update Driver Assignment"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      // Mock authentication error
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: { message: "Session expired" },
      });

      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog and try to assign driver
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      expect(driverSelectButton).toBeInTheDocument();
      await userEvent.click(driverSelectButton!);

      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
      });

      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      await userEvent.click(assignDriverButton);

      // Verify error handling
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Authentication error. Please try logging in again.",
        );
        expect(mockPush).toHaveBeenCalledWith("/auth/login");
      });
    });

    it("should handle network errors gracefully", async () => {
      // Mock network error
      mockFetch.mockImplementation(() => {
        throw new Error("Network error");
      });

      const { default: SingleOrder } = await import(
        "@/components/Orders/SingleOrder"
      );

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} />);
      });

      // Open dialog and try to assign driver
      await waitFor(() => {
        expect(screen.getByText("Assign Driver")).toBeInTheDocument();
      });

      const assignButton = screen.getByText("Assign Driver");
      await userEvent.click(assignButton);

      await waitFor(() => {
        expect(screen.getByText("David Sanchez")).toBeInTheDocument();
      });

      const driverSelectButton = screen.getAllByText("Select")[0];
      expect(driverSelectButton).toBeInTheDocument();
      await userEvent.click(driverSelectButton!);

      await waitFor(() => {
        expect(screen.getByText("Selected")).toBeInTheDocument();
      });

      const assignDriverButton = screen.getByRole("button", {
        name: /assign driver/i,
      });
      await userEvent.click(assignDriverButton);

      // Verify error handling
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to assign/edit driver. Please try again.",
        );
      });
    });
  });
});
