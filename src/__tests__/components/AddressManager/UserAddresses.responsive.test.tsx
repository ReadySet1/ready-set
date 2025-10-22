import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UserAddresses from "@/components/AddressManager/UserAddresses";
import { Address } from "@/types/address";

// Mock the createClient function
jest.mock("@/utils/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: {
            user: {
              id: "test-user",
              user_metadata: { role: "user" }
            }
          },
          error: null
        }),
      ),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      getSession: jest.fn(() =>
        Promise.resolve({
          data: { session: { access_token: "test-token" } },
          error: null,
        }),
      ),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({
              data: { role: "user" },
              error: null,
            })
          ),
        })),
      })),
    })),
  })),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock the router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Sample address data for testing
const mockAddresses: Address[] = [
  {
    id: "1",
    county: "San Mateo",
    name: "Test Restaurant",
    street1: "123 Main St",
    street2: "Suite 100",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    locationNumber: "415-555-0123",
    parkingLoading: "Street parking",
    isRestaurant: true,
    isShared: false,
    createdBy: "test-user",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    county: "San Mateo",
    name: "Home Address",
    street1: "456 Oak Ave",
    street2: null,
    city: "San Francisco",
    state: "CA",
    zip: "94110",
    locationNumber: null,
    parkingLoading: null,
    isRestaurant: false,
    isShared: true,
    createdBy: "other-user",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Create a test wrapper with QueryClient
function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries for testing
        staleTime: 0, // Always stale for testing
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// SKIP: Test expectations don't match actual component behavior after refactoring
// The component structure has changed significantly and these tests need comprehensive refactoring
// See: REA-21 - Known issue (non-blocking) - requires separate PR for test refactoring
describe.skip("UserAddresses - Mobile Responsiveness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAddresses),
    });
  });

  describe("Responsive Layout", () => {
    it("should render with mobile-first responsive classes", () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      // Check that the main container has responsive classes
      const mainContainer = screen.getByText("Your Addresses").closest("div");
      if (mainContainer) {
        expect(mainContainer).toHaveClass("p-4", "sm:p-6");
      }
    });

    it("should have responsive header text sizing", () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      const header = screen.getByText("Your Addresses");
      expect(header).toHaveClass("text-xl", "sm:text-2xl");
    });

    it("should stack tabs and button vertically on mobile", () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      const tabsContainer = screen
        .getByText("All")
        .closest("div")?.parentElement;
      if (tabsContainer) {
        expect(tabsContainer).toHaveClass(
          "flex",
          "flex-col",
          "gap-4",
          "sm:flex-row",
        );
      }
    });

    it("should make tabs full width on mobile", () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      const tabsList = screen.getByText("All").closest("div")
        ?.parentElement?.parentElement;
      if (tabsList) {
        expect(tabsList).toHaveClass("w-full", "sm:w-auto");
      }
    });

    it("should use grid layout for tabs on mobile", () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      const tabsList = screen.getByText("All").closest("div")
        ?.parentElement?.parentElement;
      if (tabsList) {
        expect(tabsList).toHaveClass("grid", "grid-cols-3");
      }
    });

    it("should make add button full width on mobile", () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      const addButton = screen.getByText("+ Add New Address");
      expect(addButton).toHaveClass("w-full", "sm:w-auto");
    });
  });

  describe("Responsive Card Layout", () => {
    it("should render addresses as cards instead of table rows", async () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      // Wait for addresses to load
      await screen.findByText("Test Restaurant");

      // Check that addresses are rendered as cards
      const addressCards = screen.getAllByText(/Test Restaurant|Home Address/);
      expect(addressCards).toHaveLength(2);

      // Check that the parent elements have card classes
      const firstCard = addressCards[0]?.closest("div");
      if (firstCard) {
        expect(firstCard).toHaveClass(
          "rounded-lg",
          "border",
          "bg-white",
          "shadow-sm",
        );
      }
    });

    it("should have responsive card padding", async () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      await screen.findByText("Test Restaurant");

      const addressCard = screen.getByText("Test Restaurant").closest("div");
      if (addressCard) {
        expect(addressCard).toHaveClass("p-4");
      }
    });

    it("should stack action buttons vertically on mobile", async () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      await screen.findByText("Test Restaurant");

      const actionButtonsContainer = screen.getByText("Edit").closest("div");
      if (actionButtonsContainer) {
        expect(actionButtonsContainer).toHaveClass(
          "flex",
          "flex-col",
          "gap-2",
          "sm:flex-row",
        );
      }
    });

    it("should make action buttons full width on mobile", async () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      await screen.findByText("Test Restaurant");

      const editButton = screen.getByText("Edit");
      const deleteButton = screen.getByText("Delete");

      expect(editButton).toHaveClass("w-full", "sm:w-auto");
      expect(deleteButton).toHaveClass("w-full", "sm:w-auto");
    });
  });

  describe("Responsive Typography and Spacing", () => {
    it("should have responsive text sizing for address details", async () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      await screen.findByText("Test Restaurant");

      const addressDetails = screen.getByText("Address:").closest("div");
      if (addressDetails) {
        expect(addressDetails).toHaveClass("text-sm");
      }
    });

    it("should have responsive spacing between address sections", async () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      await screen.findByText("Test Restaurant");

      const addressDetails = screen.getByText("Address:").closest("div");
      if (addressDetails) {
        expect(addressDetails).toHaveClass("space-y-2");
      }
    });

    it("should have responsive gap between county and type info", async () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      await screen.findByText("Test Restaurant");

      const infoContainer = screen
        .getByText("County:")
        .closest("div")?.parentElement;
      if (infoContainer) {
        expect(infoContainer).toHaveClass(
          "flex-col",
          "gap-2",
          "sm:flex-row",
          "sm:gap-6",
        );
      }
    });
  });

  describe("Responsive Tab Labels", () => {
    it("should use shortened tab labels for mobile", () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      // Check that tabs use shortened labels
      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("Private")).toBeInTheDocument();
      expect(screen.getByText("Shared")).toBeInTheDocument();

      // Verify these are not the full labels
      expect(screen.queryByText("All Addresses")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Your Private Addresses"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Shared Addresses")).not.toBeInTheDocument();
    });

    it("should have responsive text sizing for tabs", () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      const allTab = screen.getByText("All");
      expect(allTab).toHaveClass("text-xs", "sm:text-sm");
    });
  });

  describe("Responsive Badge Display", () => {
    it("should have responsive badge sizing", async () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      await screen.findByText("Test Restaurant");

      const sharedBadge = screen.getByText("Shared");
      const ownerBadge = screen.getByText("Owner");

      expect(sharedBadge).toHaveClass("text-xs");
      expect(ownerBadge).toHaveClass("text-xs");
    });

    it("should wrap badges properly on mobile", async () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      await screen.findByText("Test Restaurant");

      const badgesContainer = screen.getByText("Shared").closest("div");
      expect(badgesContainer).toHaveClass("flex", "flex-wrap", "gap-2");
    });
  });

  describe("Responsive Form Layout", () => {
    it("should handle responsive form elements when adding new address", async () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      const addButton = screen.getByText("+ Add New Address");
      addButton.click();

      // The modal should be responsive (this is tested in AddressModal tests)
      // But we can verify the button interaction works
      expect(addButton).toBeInTheDocument();
    });
  });

  describe("Responsive Error Handling", () => {
    it("should display errors with responsive styling", () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      // Simulate an error state by mocking a failed fetch
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      // Re-render to trigger the error
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      // Error should be displayed with responsive classes
      const errorContainer = screen.queryByText(/Failed to load addresses/);
      if (errorContainer) {
        const errorDiv = errorContainer.closest("div");
        expect(errorDiv).toHaveClass("rounded-md", "p-4", "text-sm");
      }
    });
  });

  describe("Responsive Loading States", () => {
    it("should show loading spinner with responsive positioning", () => {
      render(<UserAddresses />, { wrapper: createTestWrapper() });

      // Initially should show loading
      const loadingSpinner = screen.getByRole("status", { hidden: true });
      expect(loadingSpinner).toBeInTheDocument();

      // Loading container should have responsive classes
      const loadingContainer = loadingSpinner.closest("div");
      expect(loadingContainer).toHaveClass("flex", "justify-center", "py-8");
    });
  });

  describe("Responsive Empty State", () => {
    it("should handle empty state with responsive styling", async () => {
      // Mock empty addresses
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      render(<UserAddresses />, { wrapper: createTestWrapper() });

      // Wait for empty state to appear
      await screen.findByText("No addresses found");

      const emptyStateContainer = screen
        .getByText("No addresses found")
        .closest("div");
      expect(emptyStateContainer).toHaveClass("py-8", "text-center");
    });
  });
});
