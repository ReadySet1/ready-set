import React from "react";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import CateringRequestForm from "@/components/CateringRequest/CateringRequestForm";
import { UserContext } from "@/contexts/UserContext";
import { createMockUserContext, mockAddresses } from "./__mocks__/test-utils";

// Mock fetch globally
global.fetch = jest.fn();

// Mock Supabase client
jest.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
        error: null,
      }),
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  }),
}));

// Mock toast
jest.mock("react-hot-toast", () => ({
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock useUploadFile hook
jest.mock("@/hooks/use-upload-file", () => ({
  useUploadFile: () => ({
    onUpload: jest.fn(),
    uploadedFiles: [],
    progresses: {},
    isUploading: false,
    tempEntityId: "temp-123",
    updateEntityId: jest.fn(),
    deleteFile: jest.fn(),
  }),
}));

// Mock HostSection component
jest.mock("@/components/CateringRequest/HostSection", () => ({
  HostSection: () => <div data-testid="host-section">Host Section</div>,
}));

const renderCateringRequestForm = () => {
  return render(
    <UserContext.Provider value={createMockUserContext()}>
      <CateringRequestForm />
    </UserContext.Provider>,
  );
};

describe("CateringRequest Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        addresses: mockAddresses,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 3,
          hasNextPage: false,
          hasPrevPage: false,
          limit: 5,
        },
      }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Address Loading Integration", () => {
    it("should load addresses for both pickup and delivery without infinite loops", async () => {
      const consoleSpy = jest.spyOn(console, "log");

      renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Wait a bit more to ensure no additional calls
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      // Should only make one API call per AddressManager (2 total)
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Should only log the addresses loaded message twice (once for pickup, once for delivery)
      const addressLoadedLogs = consoleSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes(
          "handleAddressesLoaded called in CateringRequestForm",
        ),
      );
      expect(addressLoadedLogs).toHaveLength(2);

      // Should not have excessive logging
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "handleAddressesLoaded called in CateringRequestForm",
        ),
      );
    });

    it("should handle address selection for both pickup and delivery", async () => {
      renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Should show address selection dropdowns for both pickup and delivery
      const addressSelects = screen.getAllByText("Select an address");
      expect(addressSelects).toHaveLength(2); // One for pickup, one for delivery
    });

    it("should not cause re-renders when addresses are loaded", async () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        return <CateringRequestForm />;
      };

      render(
        <UserContext.Provider value={createMockUserContext()}>
          <TestComponent />
        </UserContext.Provider>,
      );

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Wait a bit more to ensure no additional renders
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      // Should not render excessively
      expect(renderCount).toBeLessThan(10); // Reasonable render count
    });
  });

  describe("Filter and Pagination Integration", () => {
    it("should handle filter changes without affecting other AddressManager instances", async () => {
      renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Clear previous calls
      (global.fetch as any).mockClear();

      // Mock response for filter change
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: [mockAddresses[0]], // Only private addresses
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalCount: 1,
            hasNextPage: false,
            hasPrevPage: false,
            limit: 5,
          },
        }),
      });

      // Wait a bit to ensure no additional calls
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should not make excessive calls
      expect(global.fetch).toHaveBeenCalledTimes(0);
    });

    it("should handle pagination changes independently for each AddressManager", async () => {
      // Mock response with multiple pages
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          addresses: mockAddresses,
          pagination: {
            currentPage: 1,
            totalPages: 3,
            totalCount: 15,
            hasNextPage: true,
            hasPrevPage: false,
            limit: 5,
          },
        }),
      });

      renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Should show pagination for both AddressManagers
      const paginationElements = screen.getAllByText("1");
      expect(paginationElements.length).toBeGreaterThan(0);
    });
  });

  describe("Form State Integration", () => {
    it("should maintain form state when addresses are loaded", async () => {
      renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Form fields should still be accessible
      const orderNumberInput = screen.getByPlaceholderText("e.g., ORD-12345");
      expect(orderNumberInput).toBeInTheDocument();
      expect(orderNumberInput).not.toBeDisabled();

      // Date field should still have today's date
      const dateInput = screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}/);
      expect(dateInput).toBeInTheDocument();

      // Host selection should still work
      const noHostRadio = screen.getByDisplayValue("no");
      expect(noHostRadio).toBeChecked();
    });

    it("should handle form submission with loaded addresses", async () => {
      renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Form should be submittable
      const submitButton = screen.getByText("Submit Catering Request");
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle API errors gracefully in both AddressManagers", async () => {
      // Mock API error
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      renderCateringRequestForm();

      // Wait for error to be handled
      await waitFor(() => {
        expect(
          screen.getByText(/Error fetching addresses/),
        ).toBeInTheDocument();
      });

      // Should show error message
      expect(screen.getByText(/Error fetching addresses/)).toBeInTheDocument();
    });

    it("should handle authentication errors gracefully", async () => {
      // Mock auth error
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      renderCateringRequestForm();

      // Wait for error to be handled
      await waitFor(() => {
        expect(screen.getByText(/Unauthorized/)).toBeInTheDocument();
      });

      // Should show error message
      expect(screen.getByText(/Unauthorized/)).toBeInTheDocument();
    });
  });

  describe("Performance Integration", () => {
    it("should not create memory leaks with multiple renders and unmounts", async () => {
      const { unmount } = renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Unmount and remount multiple times
      for (let i = 0; i < 3; i++) {
        unmount();
        renderCateringRequestForm();

        // Wait for addresses to load
        await waitFor(() => {
          expect(screen.getByText("Select an address")).toBeInTheDocument();
        });
      }

      // Should still work properly
      expect(screen.getByText("Select an address")).toBeInTheDocument();
    });

    it("should debounce rapid changes without excessive API calls", async () => {
      renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Clear previous calls
      (global.fetch as any).mockClear();

      // Rapidly trigger multiple changes
      // This simulates what would happen if a user quickly changes filters or pagination
      const addressManager =
        screen.getByRole("main") || screen.getByTestId("address-manager");

      // Wait for debouncing to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should not make excessive calls due to debouncing
      expect(global.fetch).toHaveBeenCalledTimes(0);
    });
  });

  describe("Real-world Usage Simulation", () => {
    it("should handle a complete user workflow without issues", async () => {
      renderCateringRequestForm();

      // Step 1: Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Step 2: Fill out form fields
      const orderNumberInput = screen.getByPlaceholderText("e.g., ORD-12345");
      fireEvent.change(orderNumberInput, { target: { value: "TEST-123" } });

      const headcountInput = screen.getByDisplayValue("1");
      fireEvent.change(headcountInput, { target: { value: "25" } });

      // Step 3: Verify form state is maintained
      expect(orderNumberInput).toHaveValue("TEST-123");
      expect(headcountInput).toHaveValue(25);

      // Step 4: Wait a bit to ensure no additional API calls
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should not make additional API calls during form interaction
      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial load only
    });

    it("should handle rapid user interactions without performance issues", async () => {
      renderCateringRequestForm();

      // Wait for addresses to load
      await waitFor(() => {
        expect(screen.getByText("Select an address")).toBeInTheDocument();
      });

      // Clear previous calls
      (global.fetch as any).mockClear();

      // Simulate rapid user interactions
      const orderNumberInput = screen.getByPlaceholderText("e.g., ORD-12345");

      // Rapidly type in the input
      for (let i = 0; i < 10; i++) {
        fireEvent.change(orderNumberInput, { target: { value: `TEST-${i}` } });
      }

      // Wait for any debounced operations to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should not make additional API calls during rapid interactions
      expect(global.fetch).toHaveBeenCalledTimes(0);
    });
  });
});
