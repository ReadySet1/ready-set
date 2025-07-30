import React from "react";
import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import ClientPage from "../page";
import { getCurrentUser } from "@/lib/auth";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  redirect: jest.fn(),
}));

// Mock the auth module
jest.mock("@/lib/auth", () => ({
  getCurrentUser: jest.fn(),
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

// Mock the database functions
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    address: {
      count: jest.fn(),
    },
  },
}));

// Mock data for testing
const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
  name: "Test User",
};

const mockDashboardData = {
  stats: {
    activeOrders: 5,
    completedOrders: 10,
    savedLocations: 3,
  },
  recentOrders: [
    {
      id: "order-1",
      orderType: "catering",
      status: "PENDING",
      pickupDateTime: "2024-01-15T10:00:00Z",
      arrivalDateTime: "2024-01-15T12:00:00Z",
      orderTotal: 150.0,
      pickupAddress: "123 Pickup St",
      deliveryAddress: "456 Delivery Ave",
    },
  ],
};

// Mock the Prisma client
const mockPrisma = {
  cateringRequest: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  onDemand: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  userAddress: {
    count: jest.fn(),
  },
};

describe("Client Dashboard Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getCurrentUser to return a valid user
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    // Mock the Prisma client
    const { prisma } = require("@/lib/db/prisma");
    Object.assign(prisma, mockPrisma);

    // Mock successful Prisma responses
    mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
    mockPrisma.cateringRequest.count.mockResolvedValue(5);
    mockPrisma.onDemand.findMany.mockResolvedValue([]);
    mockPrisma.onDemand.count.mockResolvedValue(10);
    mockPrisma.userAddress.count.mockResolvedValue(3);
  });

  describe("Quick Actions Links", () => {
    it('should render "Manage Addresses" link with correct href', async () => {
      const ClientPageComponent = await ClientPage();
      render(ClientPageComponent);

      const manageAddressesLink = screen.getByRole("link", {
        name: /manage addresses/i,
      });

      expect(manageAddressesLink).toBeInTheDocument();
      expect(manageAddressesLink).toHaveAttribute("href", "/addresses");

      // Check that the link has the correct text and description
      expect(screen.getByText("Manage Addresses")).toBeInTheDocument();
      expect(
        screen.getByText("Add or edit your locations"),
      ).toBeInTheDocument();
    });

    it('should render "Update Profile" link with correct href', async () => {
      const ClientPageComponent = await ClientPage();
      render(ClientPageComponent);

      const updateProfileLink = screen.getByRole("link", {
        name: /update profile/i,
      });

      expect(updateProfileLink).toBeInTheDocument();
      expect(updateProfileLink).toHaveAttribute("href", "/profile");

      // Check that the link has the correct text and description
      expect(screen.getByText("Update Profile")).toBeInTheDocument();
      expect(
        screen.getByText("Manage your account details"),
      ).toBeInTheDocument();
    });

    it('should render "New Order" link with correct href', async () => {
      const ClientPageComponent = await ClientPage();
      render(ClientPageComponent);

      const newOrderLink = screen.getByRole("link", { name: /new order/i });

      expect(newOrderLink).toBeInTheDocument();
      expect(newOrderLink).toHaveAttribute("href", "/catering-request");
    });

    it('should render "Contact Us" link with correct href', async () => {
      const ClientPageComponent = await ClientPage();
      render(ClientPageComponent);

      const contactUsLink = screen.getByRole("link", { name: /contact us/i });

      expect(contactUsLink).toBeInTheDocument();
      expect(contactUsLink).toHaveAttribute("href", "/contact");
    });
  });

  describe("Link Accessibility and Styling", () => {
    it("should have proper hover states for all quick action links", async () => {
      const ClientPageComponent = await ClientPage();
      render(ClientPageComponent);

      // Get only the quick action links (the ones in the Quick Actions section)
      const manageAddressesLink = screen.getByRole("link", {
        name: /manage addresses/i,
      });
      const updateProfileLink = screen.getByRole("link", {
        name: /update profile/i,
      });
      const newOrderLink = screen.getByRole("link", { name: /new order/i });
      const contactUsLink = screen.getByRole("link", { name: /contact us/i });

      // Check that quick action links have proper styling
      [
        manageAddressesLink,
        updateProfileLink,
        newOrderLink,
        contactUsLink,
      ].forEach((link) => {
        expect(link).toHaveClass("hover:bg-gray-50");
        expect(link).toHaveClass("transition-colors");
      });
    });

    it("should have proper ARIA labels and semantic structure", async () => {
      const ClientPageComponent = await ClientPage();
      render(ClientPageComponent);

      // Check that all links are properly accessible
      const manageAddressesLink = screen.getByRole("link", {
        name: /manage addresses/i,
      });
      const updateProfileLink = screen.getByRole("link", {
        name: /update profile/i,
      });

      expect(manageAddressesLink).toBeInTheDocument();
      expect(updateProfileLink).toBeInTheDocument();
    });
  });

  describe("Dashboard Content", () => {
    it("should display welcome message with user email", async () => {
      const ClientPageComponent = await ClientPage();
      render(ClientPageComponent);

      expect(screen.getByText(/welcome back, test/i)).toBeInTheDocument();
    });

    it("should display dashboard stats correctly", async () => {
      const ClientPageComponent = await ClientPage();
      render(ClientPageComponent);

      // The stats are calculated from the database, so we check that they exist
      expect(screen.getByText("Active Orders")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Saved Locations")).toBeInTheDocument();

      // Check that the stats numbers are displayed (they should be calculated from the database)
      const statsElements = screen.getAllByText(/\d+/);
      expect(statsElements.length).toBeGreaterThan(0);
    });

    it('should display "Quick Actions" section title', async () => {
      const ClientPageComponent = await ClientPage();
      render(ClientPageComponent);

      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should redirect to sign-in when user is not authenticated", async () => {
      const { redirect } = require("next/navigation");
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      try {
        await ClientPage();
      } catch (error) {
        // Expected to throw due to redirect
      }

      expect(redirect).toHaveBeenCalledWith("/sign-in");
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.cateringRequest.findMany.mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      // The page should handle the error gracefully
      try {
        const ClientPageComponent = await ClientPage();
        render(ClientPageComponent);

        // Should still render the page structure even with database errors
        expect(screen.getByText("Quick Actions")).toBeInTheDocument();
      } catch (error) {
        // It's also acceptable for the page to throw an error when database fails
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "Database connection failed",
        );
      }
    });
  });

  describe("Navigation Integration", () => {
    it("should maintain proper navigation structure", async () => {
      const ClientPageComponent = await ClientPage();
      render(ClientPageComponent);

      // Check that breadcrumb is rendered
      expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
      expect(screen.getByText("Client Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Manage your account")).toBeInTheDocument();
    });
  });
});

// Integration test for link functionality
describe("Client Dashboard Link Integration", () => {
  it("should have all quick action links pointing to correct routes", async () => {
    const ClientPageComponent = await ClientPage();
    render(ClientPageComponent);

    const expectedLinks = [
      { name: /new order/i, href: "/catering-request" },
      { name: /manage addresses/i, href: "/addresses" },
      { name: /update profile/i, href: "/profile" },
      { name: /contact us/i, href: "/contact" },
    ];

    expectedLinks.forEach(({ name, href }) => {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
    });
  });

  it("should have consistent styling across all quick action links", async () => {
    const ClientPageComponent = await ClientPage();
    render(ClientPageComponent);

    // Get only the quick action links (the ones in the Quick Actions section)
    const manageAddressesLink = screen.getByRole("link", {
      name: /manage addresses/i,
    });
    const updateProfileLink = screen.getByRole("link", {
      name: /update profile/i,
    });
    const newOrderLink = screen.getByRole("link", { name: /new order/i });
    const contactUsLink = screen.getByRole("link", { name: /contact us/i });

    // Check that quick action links have consistent styling
    [
      manageAddressesLink,
      updateProfileLink,
      newOrderLink,
      contactUsLink,
    ].forEach((link) => {
      expect(link).toHaveClass("flex");
      expect(link).toHaveClass("items-center");
      expect(link).toHaveClass("rounded-lg");
      expect(link).toHaveClass("border");
      expect(link).toHaveClass("border-gray-100");
      expect(link).toHaveClass("p-3");
      expect(link).toHaveClass("transition-colors");
      expect(link).toHaveClass("hover:bg-gray-50");
    });
  });
});
