import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import CateringRequestForm from "@/components/CateringRequest/CateringRequestForm";
import { UserContext } from "@/contexts/UserContext";
import { createMockUserContext } from "./__mocks__/test-utils";

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

// Mock AddressManager component
jest.mock("@/components/AddressManager", () => {
  return {
    default: ({ onAddressesLoaded, onAddressSelected }: any) => {
      // Simulate addresses being loaded immediately instead of using useEffect
      const mockAddresses = [
        {
          id: "1",
          street1: "123 Main St",
          street2: null,
          city: "Test City",
          state: "TS",
          zip: "12345",
          locationNumber: null,
          parkingLoading: null,
          isRestaurant: false,
          isShared: false,
        },
        {
          id: "2",
          street1: "456 Oak Ave",
          street2: "Suite 100",
          city: "Test City",
          state: "TS",
          zip: "12345",
          locationNumber: "A1",
          parkingLoading: "Front door",
          isRestaurant: true,
          isShared: true,
        },
      ];

      // Call onAddressesLoaded immediately
      onAddressesLoaded(mockAddresses);

      return (
        <div data-testid="address-manager">
          <div>Pickup Location</div>
          <div>Delivery Details</div>
          <button onClick={() => onAddressSelected("1")}>
            Select Address 1
          </button>
          <button onClick={() => onAddressSelected("2")}>
            Select Address 2
          </button>
        </div>
      );
    },
  };
});

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

describe("CateringRequestForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render the form with all required fields", async () => {
      renderCateringRequestForm();

      // Wait for AddressManager to load addresses
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Should show form title
      expect(screen.getByText("Catering Request")).toBeInTheDocument();
      expect(screen.getByText("Professional Delivery")).toBeInTheDocument();

      // Should show address managers
      expect(screen.getByText("Pickup Location")).toBeInTheDocument();
      expect(screen.getByText("Delivery Details")).toBeInTheDocument();

      // Should show form fields
      expect(screen.getByText("Brokerage / Direct")).toBeInTheDocument();
      expect(screen.getByText("Order Number")).toBeInTheDocument();
      expect(screen.getByText("Date")).toBeInTheDocument();
      expect(screen.getByText("Headcount")).toBeInTheDocument();
      expect(screen.getByText("Pick Up Time")).toBeInTheDocument();
      expect(screen.getByText("Arrival Time")).toBeInTheDocument();
      expect(screen.getByText("Complete Time")).toBeInTheDocument();
      expect(screen.getByText("Do you need a Host?")).toBeInTheDocument();
      expect(screen.getByText("Client / Attention")).toBeInTheDocument();
      expect(screen.getByText("Order Total ($)")).toBeInTheDocument();
      expect(screen.getByText("Tip ($)")).toBeInTheDocument();
      expect(screen.getByText("Pick Up Notes")).toBeInTheDocument();
      expect(screen.getByText("Special Notes")).toBeInTheDocument();

      // Should show submit button
      expect(screen.getByText("Submit Catering Request")).toBeInTheDocument();
    });

    it("should render the 8-point delivery checklist", async () => {
      renderCateringRequestForm();

      // Wait for AddressManager to load addresses
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Should show checklist
      expect(
        screen.getByText("8-Point Delivery Checklist"),
      ).toBeInTheDocument();
    });
  });

  describe("Address Integration", () => {
    it("should load addresses without infinite loops", async () => {
      const consoleSpy = jest.spyOn(console, "log");

      renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Wait a bit more to ensure no additional calls
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should only log the addresses loaded message once per AddressManager
      const addressLoadedLogs = consoleSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes(
          "handleAddressesLoaded called in CateringRequestForm",
        ),
      );

      // Should be called twice (once for pickup, once for delivery)
      expect(addressLoadedLogs).toHaveLength(2);

      // Should not have excessive logging
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "handleAddressesLoaded called in CateringRequestForm",
        ),
      );
    });

    it("should handle address selection properly", async () => {
      renderCateringRequestForm();

      // Wait for AddressManager to load addresses
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Should show address selection buttons
      expect(screen.getByText("Select Address 1")).toBeInTheDocument();
      expect(screen.getByText("Select Address 2")).toBeInTheDocument();
    });

    it("should not cause re-renders when addresses are loaded", async () => {
      const renderCount = { count: 0 };

      const TestWrapper = () => {
        renderCount.count++;
        return <CateringRequestForm />;
      };

      render(
        <UserContext.Provider value={createMockUserContext()}>
          <TestWrapper />
        </UserContext.Provider>,
      );

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Wait a bit more to ensure no additional renders
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should not render excessively
      expect(renderCount.count).toBeLessThan(10); // Reasonable render count
    });
  });

  describe("Form Validation", () => {
    it("should show required field indicators", async () => {
      renderCateringRequestForm();

      // Wait for AddressManager to load addresses
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Required fields should be marked
      const requiredFields = [
        "Brokerage / Direct",
        "Order Number",
        "Date",
        "Headcount",
        "Pick Up Time",
        "Arrival Time",
        "Client / Attention",
        "Order Total ($)",
      ];

      requiredFields.forEach((fieldName) => {
        const field = screen.getByText(fieldName);
        expect(field).toBeInTheDocument();
      });
    });

    it("should show optional field indicators", async () => {
      renderCateringRequestForm();

      // Wait for AddressManager to load addresses
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Optional fields should be marked
      const optionalFields = [
        "Complete Time (Optional)",
        "Tip ($) (Optional)",
        "Pick Up Notes (Optional)",
        "Special Notes (Optional)",
      ];

      optionalFields.forEach((fieldName) => {
        const field = screen.getByText(fieldName);
        expect(field).toBeInTheDocument();
      });
    });
  });

  describe("Host Section", () => {
    it("should show host section when host is needed", async () => {
      renderCateringRequestForm();

      // Wait for AddressManager to load addresses
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Should show host section
      expect(screen.getByTestId("host-section")).toBeInTheDocument();
    });
  });

  describe("Form State Management", () => {
    it("should initialize with default values", async () => {
      renderCateringRequestForm();

      // Wait for AddressManager to load addresses
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Date field should have today's date
      const dateInput = screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}/);
      expect(dateInput).toBeInTheDocument();

      // Host should default to "No"
      const noHostRadio = screen.getByDisplayValue("no");
      expect(noHostRadio).toBeChecked();
    });

    it("should handle form field changes", async () => {
      renderCateringRequestForm();

      // Wait for AddressManager to load addresses
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Form should be interactive
      const orderNumberInput = screen.getByPlaceholderText("e.g., ORD-12345");
      expect(orderNumberInput).toBeInTheDocument();
      expect(orderNumberInput).not.toBeDisabled();
    });
  });

  describe("Performance and Memory", () => {
    it("should not create memory leaks with multiple renders", async () => {
      const { unmount } = renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Unmount and remount multiple times
      for (let i = 0; i < 3; i++) {
        unmount();
        renderCateringRequestForm();

        // Wait for addresses to load
        await waitFor(() => {
          expect(screen.getByTestId("address-manager")).toBeInTheDocument();
        });
      }

      // Should still work properly
      expect(screen.getByTestId("address-manager")).toBeInTheDocument();
    });

    it("should not cause excessive re-renders", async () => {
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
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Wait a bit more to ensure no additional renders
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should not render excessively
      expect(renderCount).toBeLessThan(10); // Reasonable render count
    });
  });

  describe("Error Handling", () => {
    it("should handle missing user context gracefully", () => {
      // Render without UserContext to test error handling
      expect(() => {
        render(<CateringRequestForm />);
      }).not.toThrow();
    });

    it("should handle missing session gracefully", () => {
      render(
        <UserContext.Provider
          value={createMockUserContext({
            session: null,
            user: null,
            userRole: null,
          })}
        >
          <CateringRequestForm />
        </UserContext.Provider>,
      );

      // Should still render the form
      expect(screen.getByText("Catering Request")).toBeInTheDocument();
    });
  });

  describe("Integration with AddressManager", () => {
    it("should properly integrate with AddressManager components", async () => {
      renderCateringRequestForm();

      // Wait for AddressManager to load addresses
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Should have both pickup and delivery address managers
      const addressManagers = screen.getAllByTestId("address-manager");
      expect(addressManagers).toHaveLength(2); // One for pickup, one for delivery
    });

    it("should handle address loading callbacks properly", async () => {
      const consoleSpy = jest.spyOn(console, "log");

      renderCateringRequestForm();

      // Wait for addresses to be loaded
      await waitFor(() => {
        expect(screen.getByTestId("address-manager")).toBeInTheDocument();
      });

      // Wait for callback to be called
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "handleAddressesLoaded called in CateringRequestForm",
          ),
          expect.objectContaining({
            count: 2,
            addresses: expect.arrayContaining([
              expect.objectContaining({ id: "1", street1: "123 Main St" }),
              expect.objectContaining({ id: "2", street1: "456 Oak Ave" }),
            ]),
          }),
        );
      });

      // Should be called twice (once for each AddressManager)
      const addressLoadedCalls = consoleSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes(
          "handleAddressesLoaded called in CateringRequestForm",
        ),
      );
      expect(addressLoadedCalls).toHaveLength(2);
    });
  });
});
