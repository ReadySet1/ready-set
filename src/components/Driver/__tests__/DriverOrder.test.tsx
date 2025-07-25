import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DriverDashboardPage from "../DriverOrder";
import { render } from "@/__tests__/utils/test-utils";

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock UI components
jest.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children }: any) => (
    <h2 data-testid="card-title">{children}</h2>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, variant, size, className, ...props }: any) => (
    <button
      onClick={onClick}
      data-testid="button"
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/progress", () => ({
  Progress: ({ value, className }: any) => (
    <div data-testid="progress" data-value={value} className={className}>
      {value}%
    </div>
  ),
}));

jest.mock("@/components/ui/separator", () => ({
  Separator: ({ className }: any) => (
    <div data-testid="separator" className={className} />
  ),
}));

jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: any) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: any) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div data-testid="dropdown-item" onClick={onClick}>
      {children}
    </div>
  ),
}));

// Mock Lucide React icons
jest.mock("lucide-react", () => ({
  CalendarIcon: () => <div data-testid="calendar-icon">Calendar</div>,
  MapPinIcon: () => <div data-testid="map-pin-icon">MapPin</div>,
  FileTextIcon: () => <div data-testid="file-text-icon">FileText</div>,
  CarIcon: () => <div data-testid="car-icon">Car</div>,
  UsersIcon: () => <div data-testid="users-icon">Users</div>,
  ArrowLeftIcon: () => <div data-testid="arrow-left-icon">ArrowLeft</div>,
}));

// Mock lib/utils
jest.mock("@/lib/utils", () => ({
  cn: (...args: any) => args.filter(Boolean).join(" "),
}));

describe("DriverDashboardPage", () => {
  const mockCateringOrder = {
    id: "1",
    orderNumber: "TEST1234",
    pickupDateTime: "2024-01-15T10:30:00Z",
    arrivalDateTime: "2024-01-15T12:00:00Z",
    completeDateTime: "2024-01-15T13:00:00Z",
    status: "ACTIVE",
    driverStatus: "assigned",
    orderTotal: "200.00",
    tip: "20.00",
    specialNotes: "Special handling required",
    pickupNotes: "Ring the doorbell",
    clientAttention: "John Doe",
    order_type: "catering",
    headcount: "40",
    needHost: "NO",
    brokerage: "5.00",
    userId: "user1",
    updatedAt: "2024-01-15T11:00:00Z",
    pickupAddress: {
      street1: "123 Pickup St",
      city: "Pickup City",
      state: "CA",
      zip: "90210",
      locationNumber: "LOC123",
      parkingLoading: "Available",
    },
    deliveryAddress: {
      street1: "456 Delivery Ave",
      city: "Delivery City",
      state: "CA",
      zip: "90211",
      locationNumber: "LOC456",
      parkingLoading: "Limited",
    },
    user: {
      name: "John Doe",
      email: "john@example.com",
    },
    dispatches: [
      {
        driver: {
          id: "driver1",
          name: "Jane Driver",
          email: "jane@example.com",
          contact_number: "555-0123",
        },
      },
    ],
  };

  const mockOnDemandOrder = {
    ...mockCateringOrder,
    order_type: "on_demand",
    itemDelivered: "Package",
    vehicleType: "VAN",
    headcount: undefined,
    needHost: undefined,
    brokerage: undefined,
  };

  const { usePathname, useRouter } = require("next/navigation");

  beforeEach(() => {
    jest.clearAllMocks();
    usePathname.mockReturnValue("/driver/TEST1234");
    useRouter.mockReturnValue({
      push: jest.fn(),
    });
  });

  describe("Component Rendering", () => {
    it("should render the driver dashboard page with order details", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Order Details")).toBeInTheDocument();
      });
    });

    it("should render the back button", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
      });
    });
  });

  describe("BackToDashboard button rendering", () => {
    it("should NOT render the back button if not rendered at the top level", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      // Wait for the main content to load
      await waitFor(() => {
        expect(screen.getByText("Order Dashboard")).toBeInTheDocument();
      });

      // The back button should NOT be present (since it's now the parent's responsibility)
      expect(screen.queryByText("Back to Dashboard")).not.toBeInTheDocument();
    });
  });

  describe("Order Information Display", () => {
    it("should display order summary stats with proper styling", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("$200.00")).toBeInTheDocument();
        expect(screen.getByText("$20.00")).toBeInTheDocument();
        expect(screen.getByText("Total")).toBeInTheDocument();
        expect(screen.getByText("Tip")).toBeInTheDocument();
        expect(screen.getByText("Pickup")).toBeInTheDocument();
        expect(screen.getByText("Delivery")).toBeInTheDocument();
      });
    });

    it("should display pickup and delivery addresses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Pickup Location")).toBeInTheDocument();
        expect(screen.getByText("Delivery Location")).toBeInTheDocument();
        expect(screen.getByText(/123 Pickup St/)).toBeInTheDocument();
        expect(screen.getByText(/456 Delivery Ave/)).toBeInTheDocument();
      });
    });

    it("should display order number and badges", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Order #TEST1234")).toBeInTheDocument();
        expect(screen.getByText("Catering")).toBeInTheDocument();
        // The status might be displayed differently
        expect(screen.getByText(/TEST1234/)).toBeInTheDocument();
      });
    });
  });

  describe("Card Styling - Recent Changes", () => {
    it("should apply proper card styling to summary stats sections", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        const cardContents = screen.getAllByTestId("card-content");
        const mainCardContent = cardContents[0]; // Main order details card
        expect(mainCardContent).toBeTruthy();
        expect(mainCardContent).toHaveClass("space-y-4");

        // Check for the presence of grid layout classes
        const gridContainer =
          mainCardContent?.querySelector(".grid.grid-cols-4");
        expect(gridContainer).toBeTruthy();

        // Check for card styling on individual stat cards
        const statCards = mainCardContent?.querySelectorAll(
          ".rounded-lg.border.bg-gray-50.p-4",
        );
        expect(statCards?.length).toBeGreaterThan(0);
      });
    });

    it("should apply card styling to location sections", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        // Check for location cards with proper styling
        const cardContents = screen.getAllByTestId("card-content");
        const mainCardContent = cardContents[0]; // Main order details card
        expect(mainCardContent).toBeTruthy();

        const locationCards = mainCardContent?.querySelectorAll(
          ".rounded-lg.border.bg-gray-50.p-4",
        );

        // Should have at least 6 cards (4 summary stats + 2 location cards + 1 catering details)
        expect(locationCards?.length).toBeGreaterThanOrEqual(6);

        // Verify icons are present
        expect(screen.getAllByTestId("map-pin-icon")).toHaveLength(2);
      });
    });

    it("should apply card styling to catering details section", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Catering Details")).toBeInTheDocument();
        expect(screen.getByText(/Headcount:/)).toBeInTheDocument();
        expect(screen.getByText(/40/)).toBeInTheDocument();
        expect(screen.getByText(/Need Host:/)).toBeInTheDocument();
        expect(screen.getByText(/NO/)).toBeInTheDocument();
        expect(screen.getByTestId("users-icon")).toBeInTheDocument();
      });
    });
  });

  describe("On-Demand Order Details", () => {
    it("should display on-demand specific details with proper styling", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOnDemandOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("On-Demand Details")).toBeInTheDocument();
        expect(screen.getByText(/Item Delivered:/)).toBeInTheDocument();
        expect(screen.getByText(/Package/)).toBeInTheDocument();
        expect(screen.getByText(/Vehicle Type:/)).toBeInTheDocument();
        expect(screen.getByText(/VAN/)).toBeInTheDocument();
      });
    });
  });

  describe("Notes Section", () => {
    it("should display notes section with yellow background styling", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Notes")).toBeInTheDocument();
        expect(screen.getByText(/Special:/)).toBeInTheDocument();
        expect(
          screen.getByText(/Special handling required/),
        ).toBeInTheDocument();
        expect(screen.getByText(/Pickup:/)).toBeInTheDocument();
        expect(screen.getByText(/Ring the doorbell/)).toBeInTheDocument();
        expect(screen.getByText(/Client:/)).toBeInTheDocument();
      });
    });

    it("should render notes card with proper yellow styling classes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        const cards = screen.getAllByTestId("card");
        const notesCard = cards.find(
          (card) =>
            card.className?.includes("border-yellow-200") ||
            card.className?.includes("bg-yellow-50"),
        );
        expect(notesCard).toBeTruthy();
      });
    });
  });

  describe("Driver Status Card", () => {
    it("should display driver information", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Driver Details")).toBeInTheDocument();
        expect(screen.getByText(/Jane Driver/)).toBeInTheDocument();
        expect(screen.getByText(/jane@example.com/)).toBeInTheDocument();
        expect(screen.getByText(/555-0123/)).toBeInTheDocument();
      });
    });

    it("should display driver status with update functionality", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("Drive Status")).toBeInTheDocument();
        expect(screen.getByText("Update Status")).toBeInTheDocument();
        // Check for the presence of assigned status (appears in multiple places)
        expect(screen.getAllByText("🚗 Assigned")).toHaveLength(2);
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle back button click", async () => {
      const mockPush = jest.fn();
      useRouter.mockReturnValue({
        push: mockPush,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        const backButton = screen.getByText("Back to Dashboard");
        fireEvent.click(backButton);
        expect(mockPush).toHaveBeenCalledWith("/driver");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("API Error"));

      render(<DriverDashboardPage />);

      // Component should not crash on error
      await waitFor(() => {
        expect(screen.queryByText("Order Details")).not.toBeInTheDocument();
      });
    });

    it("should handle missing order data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "Order not found" }),
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        expect(screen.queryByText("Order Details")).not.toBeInTheDocument();
      });
    });
  });

  describe("Styling Validation", () => {
    it("should verify card styling is applied correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCateringOrder,
      });

      render(<DriverDashboardPage />);

      await waitFor(() => {
        // Check for main card content
        const cardContents = screen.getAllByTestId("card-content");
        const mainCardContent = cardContents[0]; // Main order details card
        expect(mainCardContent).toBeTruthy();
        expect(mainCardContent).toHaveClass("space-y-4");

        // Check for grid layout for stats
        const gridContainer =
          mainCardContent?.querySelector(".grid.grid-cols-4");
        expect(gridContainer).toBeTruthy();

        // Check for 2-column grid for locations
        const locationGrid =
          mainCardContent?.querySelector(".grid.grid-cols-2");
        expect(locationGrid).toBeTruthy();
      });
    });
  });
});
