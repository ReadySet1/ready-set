import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => "/client",
  redirect: jest.fn(),
}));

// Mock authentication
jest.mock("@/lib/auth", () => ({
  getCurrentUser: jest.fn().mockResolvedValue({
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
  }),
  getUserRole: jest.fn().mockResolvedValue("client"),
}));

// Mock withDatabaseRetry function
jest.mock("@/lib/db/prisma", () => ({
  withDatabaseRetry: jest.fn((fn) => fn()),
  prisma: {
    cateringRequest: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "catering-1",
          orderNumber: "TEST 00126",
          status: "ACTIVE",
          pickupDateTime: new Date("2025-08-06T11:15:00Z"),
          arrivalDateTime: new Date("2025-08-06T11:45:00Z"),
          orderTotal: 600.0,
        },
      ]),
      count: jest.fn().mockResolvedValue(23),
    },
    onDemand: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    userAddress: {
      count: jest.fn().mockResolvedValue(5),
    },
  },
}));

// Mock the order status types
jest.mock("@/types/order-status", () => ({
  CateringStatus: {
    ACTIVE: "ACTIVE",
    ASSIGNED: "ASSIGNED",
    COMPLETED: "COMPLETED",
  },
  OnDemandStatus: {
    ACTIVE: "ACTIVE",
    ASSIGNED: "ASSIGNED",
    COMPLETED: "COMPLETED",
  },
  OrderStatus: {
    ACTIVE: "ACTIVE",
    COMPLETED: "COMPLETED",
  },
  getStatusColorClasses: jest
    .fn()
    .mockReturnValue("bg-green-100 text-green-800"),
}));

// Mock the CombinedOrder type
jest.mock("@/types/models", () => ({
  CombinedOrder: jest.fn(),
}));

// Mock the Breadcrumb component
jest.mock("@/components/Common/Breadcrumb", () => {
  return function MockBreadcrumb({
    pageName,
    pageDescription,
  }: {
    pageName: string;
    pageDescription: string;
  }) {
    return (
      <div data-testid="breadcrumb">
        <h1>{pageName}</h1>
        <p>{pageDescription}</p>
      </div>
    );
  };
});

// Import the component after mocks are set up
import ClientPage from "@/app/(site)/(users)/client/page";

/**
 * TODO: REA-211 - Client Dashboard tests have server component rendering issues
 */
describe.skip("Client Dashboard Navigation Link Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render the client dashboard with correct page title", async () => {
    render(await ClientPage());

    expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
    expect(screen.getByText("Client Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Manage your account")).toBeInTheDocument();
  });

  it("should display welcome message with user information", async () => {
    render(await ClientPage());

    expect(screen.getByText(/Welcome back, test!/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Track orders, manage your deliveries, and update your profile information./,
      ),
    ).toBeInTheDocument();
  });

  it("should display quick actions section with correct title", async () => {
    render(await ClientPage());

    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
  });

  it('should have "New Order" link in quick actions that points to catering request', async () => {
    render(await ClientPage());

    const newOrderLink = screen.getByText("New Order").closest("a");
    expect(newOrderLink).toBeInTheDocument();
    expect(newOrderLink).toHaveAttribute("href", "/catering-request");
  });

  it('should have "Place Your First Order" link when no orders exist', async () => {
    // Mock empty orders
    const { prisma } = require("@/lib/db/prisma");
    prisma.cateringRequest.findMany.mockResolvedValueOnce([]);
    prisma.onDemand.findMany.mockResolvedValueOnce([]);

    render(await ClientPage());

    const placeFirstOrderLink = screen
      .getByText("Place Your First Order")
      .closest("a");
    expect(placeFirstOrderLink).toBeInTheDocument();
    expect(placeFirstOrderLink).toHaveAttribute("href", "/catering-request");
  });

  it("should have correct quick action links with proper href attributes", async () => {
    render(await ClientPage());

    // Test Manage Addresses link
    const manageAddressesLink = screen
      .getByText("Manage Addresses")
      .closest("a");
    expect(manageAddressesLink).toBeInTheDocument();
    expect(manageAddressesLink).toHaveAttribute("href", "/addresses");

    // Test Update Profile link
    const updateProfileLink = screen.getByText("Update Profile").closest("a");
    expect(updateProfileLink).toBeInTheDocument();
    expect(updateProfileLink).toHaveAttribute("href", "/profile");

    // Test Contact Us link
    const contactUsLink = screen.getByText("Contact Us").closest("a");
    expect(contactUsLink).toBeInTheDocument();
    expect(contactUsLink).toHaveAttribute("href", "/contact");
  });

  it("should display recent orders section with correct title", async () => {
    render(await ClientPage());

    expect(screen.getByText("Recent Orders")).toBeInTheDocument();
    expect(screen.getByText("View All")).toBeInTheDocument();
  });

  it('should have "View All" link that points to client orders', async () => {
    render(await ClientPage());

    const viewAllLink = screen.getByText("View All").closest("a");
    expect(viewAllLink).toBeInTheDocument();
    expect(viewAllLink).toHaveAttribute("href", "/client/orders");
  });

  it("should display recent orders with correct information", async () => {
    render(await ClientPage());

    // Check for the test order
    expect(screen.getByText("TEST 00126")).toBeInTheDocument();
    expect(screen.getByText("$600.00")).toBeInTheDocument();
    expect(screen.getByText("View Details")).toBeInTheDocument();
  });

  it("should have proper styling classes on navigation links", async () => {
    render(await ClientPage());

    const newOrderLink = screen.getByText("New Order").closest("a");
    expect(newOrderLink).toHaveClass(
      "flex",
      "items-center",
      "rounded-lg",
      "border",
      "border-gray-100",
      "p-3",
      "transition-colors",
      "hover:bg-gray-50",
    );
  });

  it("should handle navigation when user is not authenticated", async () => {
    // Mock unauthenticated user
    const { getCurrentUser } = require("@/lib/auth");
    getCurrentUser.mockResolvedValueOnce(null);

    const { redirect } = require("next/navigation");

    try {
      await ClientPage();
    } catch (error) {
      // Expected to redirect
    }

    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});

/**
 * TODO: REA-211 - Client Dashboard link functionality tests have server component issues
 */
describe.skip("Client Dashboard Link Functionality - Core Navigation Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have "New Order" link with correct href attribute', async () => {
    render(await ClientPage());

    const newOrderLink = screen.getByText("New Order").closest("a");
    expect(newOrderLink).toHaveAttribute("href", "/catering-request");
  });

  it('should have "Place Your First Order" link with correct href attribute when no orders', async () => {
    // Mock empty orders
    const { prisma } = require("@/lib/db/prisma");
    prisma.cateringRequest.findMany.mockResolvedValueOnce([]);
    prisma.onDemand.findMany.mockResolvedValueOnce([]);

    render(await ClientPage());

    const placeFirstOrderLink = screen
      .getByText("Place Your First Order")
      .closest("a");
    expect(placeFirstOrderLink).toHaveAttribute("href", "/catering-request");
  });

  it("should maintain all other navigation links with correct href attributes", async () => {
    render(await ClientPage());

    // Test View All orders link
    const viewAllLink = screen.getByText("View All").closest("a");
    expect(viewAllLink).toHaveAttribute("href", "/client/orders");

    // Test Manage Addresses link
    const manageAddressesLink = screen
      .getByText("Manage Addresses")
      .closest("a");
    expect(manageAddressesLink).toHaveAttribute("href", "/addresses");

    // Test Update Profile link
    const updateProfileLink = screen.getByText("Update Profile").closest("a");
    expect(updateProfileLink).toHaveAttribute("href", "/profile");

    // Test Contact Us link
    const contactUsLink = screen.getByText("Contact Us").closest("a");
    expect(contactUsLink).toHaveAttribute("href", "/contact");
  });

  it("should have correct link text and descriptions", async () => {
    render(await ClientPage());

    // Check New Order link text and description
    expect(screen.getByText("New Order")).toBeInTheDocument();
    expect(
      screen.getByText("Create a new delivery request"),
    ).toBeInTheDocument();

    // Check other quick action descriptions
    expect(screen.getByText("Add or edit your locations")).toBeInTheDocument();
    expect(screen.getByText("Manage your account details")).toBeInTheDocument();
    expect(screen.getByText("Get in touch with our team")).toBeInTheDocument();
  });
});
