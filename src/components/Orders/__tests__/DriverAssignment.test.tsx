import React from "react";
import {
  render,
  screen,
  waitFor,
  act,
  cleanup,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { UserType } from "@/types/user";
import SingleOrder from "@/components/Orders/SingleOrder";
import {
  mockRouter,
  mockPathname,
  mockSupabase,
  mockOrder,
  mockDrivers,
} from "./utils/test-utils";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname(),
  useParams: () => ({ order_number: "SF-56780" }),
}));

// Mock Supabase client
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

// Stub OrderFilesManager to avoid invoking use-upload-file hook in these tests
jest.mock("@/components/Orders/ui/OrderFiles", () => ({
  OrderFilesManager: () => <div data-testid="order-files-manager" />,
}));

// Mock broker sync service
jest.mock("@/lib/services/brokerSyncService", () => ({
  syncOrderStatusWithBroker: jest.fn().mockResolvedValue(undefined),
}));

// Mock date-display utility
jest.mock("@/lib/utils/date-display", () => ({
  formatDateTimeForDisplay: jest.fn((date) =>
    date ? "Jan 1, 2024 12:00 PM" : "N/A",
  ),
  formatDateForDisplay: jest.fn((date) => (date ? "Jan 1, 2024" : "N/A")),
  formatTimeForDisplay: jest.fn((date) => (date ? "12:00 PM" : "N/A")),
  getRelativeTime: jest.fn(() => "just now"),
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock framer-motion
jest.mock("framer-motion", () => {
  const actual = jest.requireActual("framer-motion");
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
      tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
      span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
      li: ({ children, ...props }: any) => <li {...props}>{children}</li>,
      ul: ({ children, ...props }: any) => <ul {...props}>{children}</ul>,
      table: ({ children, ...props }: any) => (
        <table {...props}>{children}</table>
      ),
      tbody: ({ children, ...props }: any) => (
        <tbody {...props}>{children}</tbody>
      ),
      td: ({ children, ...props }: any) => <td {...props}>{children}</td>,
      th: ({ children, ...props }: any) => <th {...props}>{children}</th>,
    },
    AnimatePresence: ({ children }: any) => children,
  };
});

describe("Driver Assignment Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset(); // Reset mock implementation
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
    cleanup();
    jest.restoreAllMocks();
  });

  describe("Driver Assignment Dialog", () => {
    it("should open driver assignment dialog when Assign Driver button is clicked", async () => {
      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      const assignButton = await screen.findByRole("button", {
        name: "Assign Driver",
      });
      await userEvent.click(assignButton);

      await waitFor(() => {
        expect(
          screen.getByText("Select a driver to assign to this order."),
        ).toBeInTheDocument();
      });
    });

    it("should display available drivers in the dialog", async () => {
      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      const assignButton = await screen.findByRole("button", {
        name: "Assign Driver",
      });
      await userEvent.click(assignButton);

      // Use findAllByText to wait for drivers to appear in the list
      const davidElements = await screen.findAllByText("David Sanchez");
      expect(davidElements.length).toBeGreaterThan(0);

      const johnElements = await screen.findAllByText("John Doe");
      expect(johnElements.length).toBeGreaterThan(0);
    });

    it("should allow driver selection", async () => {
      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      const assignButton = await screen.findByRole("button", {
        name: "Assign Driver",
      });
      await userEvent.click(assignButton);

      // Wait for drivers
      await screen.findAllByText("David Sanchez");

      // Select first driver
      const driverSelectButtons = await screen.findAllByText("Select");
      await userEvent.click(driverSelectButtons[0]);

      // Verify selection
      const selectedBadges = await screen.findAllByText("Selected");
      expect(selectedBadges.length).toBeGreaterThan(0);
    });
  });

  describe("Driver Assignment Flow", () => {
    it("should successfully assign a driver and close dialog", async () => {
      // Explicitly set mock for this test
      mockFetch.mockImplementation((url: string) => {
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
        // Default fallbacks
        if (url.includes("/api/orders/SF-56780?include=dispatch.driver")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrder),
          });
        }
        if (url.includes("/api/drivers")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockDrivers),
          });
        }
        if (url.includes("/api/orders/SF-56780/files")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      const assignButton = await screen.findByRole("button", {
        name: "Assign Driver",
      });
      await userEvent.click(assignButton);

      // Wait for and select driver
      await screen.findAllByText("David Sanchez");
      const driverSelectButtons = await screen.findAllByText("Select");
      await userEvent.click(driverSelectButtons[0]);

      // Click dialog's Assign Driver button (might duplicate with main page button text)
      // The dialog button is usually inside the dialog
      const dialog = await screen.findByRole("dialog");
      const confirmButton = within(dialog).getByRole("button", {
        name: /Assign Driver/i,
      });
      
      // Use fireEvent to bypass potential pointer-events issues in JSDOM/Radix
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/orders/assignDriver",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("d2e6f3ef-d801-4dd0-b840-c8de7754a6bd"),
          }),
        );
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Driver assigned successfully!",
        );
      });
    });

    it("should handle driver assignment API errors gracefully", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/orders/assignDriver")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: "Internal server error" }),
          });
        }
        // keep other mocks
        if (url.includes("/api/orders/SF-56780?include=dispatch.driver")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrder),
          });
        }
        if (url.includes("/api/drivers")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockDrivers),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      const assignButton = await screen.findByRole("button", {
        name: "Assign Driver",
      });
      await userEvent.click(assignButton);

      await screen.findAllByText("David Sanchez");
      const driverSelectButtons = await screen.findAllByText("Select");
      await userEvent.click(driverSelectButtons[0]);

      const dialog = await screen.findByRole("dialog");
      const confirmButton = within(dialog).getByRole("button", {
        name: /Assign Driver/i,
      });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Failed to assign/edit driver"));
      });
    });

    it("should enable Assign Driver button when a driver is selected", async () => {
      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      const assignButton = await screen.findByRole("button", {
        name: "Assign Driver",
      });
      await userEvent.click(assignButton);

      await screen.findAllByText("David Sanchez");
      const driverSelectButtons = await screen.findAllByText("Select");
      await userEvent.click(driverSelectButtons[0]);

      const dialog = await screen.findByRole("dialog");
      const confirmButton = within(dialog).getByRole("button", {
        name: /Assign Driver/i,
      });
      expect(confirmButton).not.toBeDisabled();
    });
  });

  describe("Driver Information Display", () => {
    it("should display driver information after successful assignment", async () => {
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
        if (url.includes("/api/drivers")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockDrivers),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      const driverNames = await screen.findAllByText("David Sanchez");
      expect(driverNames.length).toBeGreaterThan(0);
      expect(screen.getByText("davids2002@gmail.com")).toBeInTheDocument();
    });

    it("should show Update Driver button when driver is already assigned", async () => {
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
        if (url.includes("/api/drivers")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockDrivers),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      await act(async () => {
        render(
          <SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />,
        );
      });

      // Update Driver button replaces Assign Driver button inside the Status Card or Header
      // Note: The main button always says "Assign Driver", but the dialog should be in update mode
      
      // Check if driver info is displayed first
      await screen.findByText("David Sanchez");
      
      const assignButtons = await screen.findAllByText("Assign Driver");
      expect(assignButtons.length).toBeGreaterThan(0);

      // Click one
      await userEvent.click(assignButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Update Driver Assignment")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
       mockFetch.mockImplementation((url: string) => {
        if (url.includes("/api/orders/assignDriver")) {
          throw new Error("Network error");
        }
        // Defaults
        if (url.includes("/api/orders/SF-56780?include=dispatch.driver")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOrder) });
        }
        if (url.includes("/api/drivers")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDrivers) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      await act(async () => {
        render(<SingleOrder onDeleteSuccess={() => {}} canAssignDriver={true} />);
      });

      const assignButton = await screen.findByRole("button", { name: "Assign Driver" });
      await userEvent.click(assignButton);

      await screen.findAllByText("David Sanchez");
      const driverSelectButtons = await screen.findAllByText("Select");
      await userEvent.click(driverSelectButtons[0]);

      const dialog = await screen.findByRole("dialog");
      const confirmButton = within(dialog).getByRole("button", { name: /Assign Driver/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Network error"));
      });
    });
  });
});
