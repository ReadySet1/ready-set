/**
 * Unit Tests for Email Notification Service
 *
 * Tests all three main email functions:
 * - sendUserWelcomeEmail (6 role types + admin-created vs self-registration)
 * - sendOrderNotificationToAdmin (catering + on-demand orders)
 * - sendOrderConfirmationToCustomer
 *
 * Coverage areas:
 * - Successful email sending
 * - Error handling (no API key, network failures)
 * - Template generation
 * - Lazy initialization
 * - Different user roles and scenarios
 */

import { UserType } from "@prisma/client";
import {
  sendUserWelcomeEmail,
  sendOrderNotificationToAdmin,
  sendOrderConfirmationToCustomer,
} from "../email-notification";
import {
  createMockResendClient,
  createFailingResendClient,
  createUnauthorizedResendClient,
  expectEmailSent,
  expectEmailContains,
  expectEmailNotSent,
  validateBrandElements,
  validateEmailHtml,
  setupEmailTestEnv,
  clearEmailTestEnv,
} from "@/__tests__/helpers/email-test-helpers";

// Mock Resend
jest.mock("resend");

// Mock email template utilities
jest.mock("@/utils/email-templates", () => {
  const actual = jest.requireActual("@/utils/email-templates");
  return {
    ...actual,
    generateUnifiedEmailTemplate: jest.fn(({ title, greeting, content, ctaUrl, ctaText }) => {
      return `
        <html>
          <body>
            <h1>${title}</h1>
            <h2>${greeting}</h2>
            <div>${content}</div>
            <a href="${ctaUrl}">${ctaText}</a>
          </body>
        </html>
      `;
    }),
  };
});

describe("Email Notification Service", () => {
  let mockResendClient: ReturnType<typeof createMockResendClient>;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup test environment
    setupEmailTestEnv();
    process.env.NEXT_PUBLIC_SITE_URL = "https://test.readysetllc.com";

    // Create fresh mock for each test
    mockResendClient = createMockResendClient();

    // Mock the Resend constructor
    const { Resend } = require("resend");
    Resend.mockImplementation(() => mockResendClient);

    // Spy on console methods
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  afterAll(() => {
    clearEmailTestEnv();
  });

  // ============================================================================
  // sendUserWelcomeEmail Tests
  // ============================================================================

  describe("sendUserWelcomeEmail", () => {
    describe("Self-Registration Scenarios", () => {
      it("should send welcome email to client (self-registration)", async () => {
        const userData = {
          email: "client@example.com",
          name: "John Doe",
          userType: "client" as const,
          isAdminCreated: false,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          to: userData.email,
          subject: "Welcome to Ready Set - Your Client Account is Ready!",
        });

        // Verify content includes self-registration instructions
        expectEmailContains(mockResendClient.emails.send, [
          "Thank you for registering",
          "confirmation link",
          "verify your email address",
        ]);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Welcome email sent successfully to ${userData.email}`)
        );
      });

      it("should send welcome email to vendor (self-registration)", async () => {
        const userData = {
          email: "vendor@example.com",
          name: "Jane Vendor",
          userType: "vendor" as const,
          isAdminCreated: false,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          to: userData.email,
          subject: "Welcome to Ready Set - Your Vendor Account is Ready!",
        });
      });

      it("should send welcome email to driver (self-registration)", async () => {
        const userData = {
          email: "driver@example.com",
          name: "Bob Driver",
          userType: "driver" as const,
          isAdminCreated: false,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          to: userData.email,
          subject: "Welcome to Ready Set - Your Driver Account is Ready!",
        });
      });

      it("should send welcome email to helpdesk (self-registration)", async () => {
        const userData = {
          email: "helpdesk@example.com",
          name: "Support User",
          userType: "helpdesk" as const,
          isAdminCreated: false,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          to: userData.email,
          subject: "Welcome to Ready Set - Your Helpdesk Account is Ready!",
        });
      });

      it("should send welcome email to admin (self-registration)", async () => {
        const userData = {
          email: "admin@example.com",
          name: "Admin User",
          userType: "admin" as const,
          isAdminCreated: false,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          to: userData.email,
          subject: "Welcome to Ready Set - Your Admin Account is Ready!",
        });
      });

      it("should send welcome email to super_admin (self-registration)", async () => {
        const userData = {
          email: "superadmin@example.com",
          name: "Super Admin",
          userType: "super_admin" as const,
          isAdminCreated: false,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          to: userData.email,
          subject: "Welcome to Ready Set - Your Super admin Account is Ready!",
        });
      });
    });

    describe("Admin-Created Account Scenarios", () => {
      it("should send welcome email with temporary password (admin-created)", async () => {
        const userData = {
          email: "newuser@example.com",
          name: "New User",
          userType: "client" as const,
          temporaryPassword: "TempPass123!",
          isAdminCreated: true,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          to: userData.email,
        });

        // Verify content includes temporary password and security notice
        expectEmailContains(mockResendClient.emails.send, [
          "created by an administrator",
          userData.temporaryPassword,
          "Security Notice",
          "change your password",
        ]);
      });

      it("should format user type label correctly (underscore handling)", async () => {
        const userData = {
          email: "superadmin@example.com",
          name: "Super Admin",
          userType: "super_admin" as const,
          temporaryPassword: "TempPass123!",
          isAdminCreated: true,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          subject: "Welcome to Ready Set - Your Super admin Account is Ready!",
        });
      });
    });

    describe("Error Handling", () => {
      it("should handle missing RESEND_API_KEY gracefully", async () => {
        // Remove API key
        delete process.env.RESEND_API_KEY;

        const userData = {
          email: "user@example.com",
          name: "Test User",
          userType: "client" as const,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "RESEND_API_KEY not configured"
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Resend client not available")
        );
        expectEmailNotSent(mockResendClient.emails.send);
      });

      it("should handle Resend API errors gracefully", async () => {
        const failingClient = createFailingResendClient({
          statusCode: 500,
          message: "Internal Server Error",
        });

        const { Resend } = require("resend");
        Resend.mockImplementation(() => failingClient);

        const userData = {
          email: "user@example.com",
          name: "Test User",
          userType: "client" as const,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Error sending welcome email"),
          expect.anything()
        );
      });

      it("should handle unauthorized API key error", async () => {
        const unauthorizedClient = createUnauthorizedResendClient();

        const { Resend } = require("resend");
        Resend.mockImplementation(() => unauthorizedClient);

        const userData = {
          email: "user@example.com",
          name: "Test User",
          userType: "client" as const,
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe("Template Generation", () => {
      it("should use correct CTA for self-registration", async () => {
        const userData = {
          email: "user@example.com",
          name: "Test User",
          userType: "client" as const,
          isAdminCreated: false,
        };

        await sendUserWelcomeEmail(userData);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("Go to Login Page");
        expect(lastCall.html).toContain("/sign-in");
      });

      it("should use correct CTA for admin-created account", async () => {
        const userData = {
          email: "user@example.com",
          name: "Test User",
          userType: "client" as const,
          temporaryPassword: "TempPass123!",
          isAdminCreated: true,
        };

        await sendUserWelcomeEmail(userData);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("Login to Your Account");
        expect(lastCall.html).toContain("/sign-in");
      });
    });
  });

  // ============================================================================
  // sendOrderNotificationToAdmin Tests
  // ============================================================================

  describe("sendOrderNotificationToAdmin", () => {
    const baseOrderData = {
      orderNumber: "ORD-12345",
      customerName: "John Customer",
      customerEmail: "customer@example.com",
      brokerage: "Test Brokerage",
      date: new Date("2025-01-15"),
      pickupTime: new Date("2025-01-15T10:00:00"),
      arrivalTime: new Date("2025-01-15T12:00:00"),
      orderTotal: 150.5,
      clientAttention: "Handle with care",
      status: "pending",
      pickupAddress: {
        street1: "123 Pickup St",
        street2: "Suite 100",
        city: "Los Angeles",
        state: "CA",
        zip: "90001",
        county: "Los Angeles",
      },
      deliveryAddress: {
        street1: "456 Delivery Ave",
        city: "Los Angeles",
        state: "CA",
        zip: "90002",
      },
    };

    describe("Catering Orders", () => {
      it("should send catering order notification to admin", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          headcount: "50",
          needHost: "Yes",
          hoursNeeded: "3",
          numberOfHosts: "2",
          pickupNotes: "Use back entrance",
          specialNotes: "Vegetarian options required",
        };

        const result = await sendOrderNotificationToAdmin(orderData);

        expect(result).toBe(true);
        expect(mockResendClient.emails.send).toHaveBeenCalled();

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.subject).toBe("New Catering Order - ORD-12345");

        // Verify catering-specific content
        expectEmailContains(mockResendClient.emails.send, [
          orderData.orderNumber,
          orderData.customerName,
          orderData.headcount,
          orderData.needHost,
          orderData.pickupNotes,
          orderData.specialNotes,
        ]);
      });

      it("should format catering order details correctly", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          headcount: "100",
          needHost: "No",
        };

        await sendOrderNotificationToAdmin(orderData);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("Catering");
        expect(lastCall.html).toContain("$150.50"); // Formatted total
      });
    });

    describe("On-Demand Orders", () => {
      it("should send on-demand order notification to admin", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "on_demand" as const,
          itemDelivered: "Electronics",
          vehicleType: "Van",
          dimensions: {
            length: "24",
            width: "18",
            height: "12",
          },
          weight: "50 lbs",
        };

        const result = await sendOrderNotificationToAdmin(orderData);

        expect(result).toBe(true);
        expect(mockResendClient.emails.send).toHaveBeenCalled();

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.subject).toBe("New On-Demand Order - ORD-12345");

        // Verify on-demand specific content
        expectEmailContains(mockResendClient.emails.send, [
          orderData.orderNumber,
          orderData.itemDelivered,
          orderData.vehicleType,
          orderData.weight,
        ]);
      });

      it("should format dimensions correctly", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "on_demand" as const,
          dimensions: {
            length: "24",
            width: "18",
            height: "12",
          },
        };

        await sendOrderNotificationToAdmin(orderData);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("24 x 18 x 12");
      });

      it("should handle missing dimensions gracefully", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "on_demand" as const,
          dimensions: {
            length: "24",
            width: null,
            height: null,
          },
        };

        const result = await sendOrderNotificationToAdmin(orderData);

        expect(result).toBe(true);
        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("24 x N/A x N/A");
      });
    });

    describe("Address Formatting", () => {
      it("should format complete address with all fields", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
        };

        await sendOrderNotificationToAdmin(orderData);

        expectEmailContains(mockResendClient.emails.send, [
          "123 Pickup St",
          "Suite 100",
          "Los Angeles",
          "CA",
          "90001",
        ]);
      });

      it("should handle address without street2", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          deliveryAddress: {
            street1: "456 Delivery Ave",
            street2: null,
            city: "Los Angeles",
            state: "CA",
            zip: "90002",
          },
        };

        const result = await sendOrderNotificationToAdmin(orderData);

        expect(result).toBe(true);
        expectEmailContains(mockResendClient.emails.send, [
          "456 Delivery Ave",
          "Los Angeles",
        ]);
      });
    });

    describe("Optional Fields", () => {
      it("should handle missing optional fields", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          brokerage: null,
          clientAttention: null,
          status: null,
          pickupNotes: null,
          specialNotes: null,
        };

        const result = await sendOrderNotificationToAdmin(orderData);

        expect(result).toBe(true);
        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("N/A");
      });

      it("should include driver status when provided", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          driverStatus: "En Route",
        };

        await sendOrderNotificationToAdmin(orderData);

        expectEmailContains(mockResendClient.emails.send, ["En Route"]);
      });

      it("should include complete time when provided", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          completeTime: new Date("2025-01-15T14:00:00"),
        };

        await sendOrderNotificationToAdmin(orderData);

        expect(mockResendClient.emails.send).toHaveBeenCalled();
      });
    });

    describe("Error Handling", () => {
      it("should handle missing RESEND_API_KEY gracefully", async () => {
        delete process.env.RESEND_API_KEY;

        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
        };

        const result = await sendOrderNotificationToAdmin(orderData);

        expect(result).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Resend client not available")
        );
      });

      it("should handle Resend API errors", async () => {
        const failingClient = createFailingResendClient();
        const { Resend } = require("resend");
        Resend.mockImplementation(() => failingClient);

        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
        };

        const result = await sendOrderNotificationToAdmin(orderData);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });

    describe("Date/Time Formatting", () => {
      it("should format dates and times correctly", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          date: new Date("2025-01-15T00:00:00"),
          pickupTime: new Date("2025-01-15T10:30:00"),
          arrivalTime: new Date("2025-01-15T12:45:00"),
        };

        const result = await sendOrderNotificationToAdmin(orderData);

        expect(result).toBe(true);
        expect(mockResendClient.emails.send).toHaveBeenCalled();
      });

      it("should handle null dates gracefully", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          date: null,
          pickupTime: null,
          arrivalTime: null,
        };

        const result = await sendOrderNotificationToAdmin(orderData);

        expect(result).toBe(true);
        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("N/A");
      });
    });

    describe("Order Total Formatting", () => {
      it("should format numeric order total", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          orderTotal: 1234.56,
        };

        await sendOrderNotificationToAdmin(orderData);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("$1234.56");
      });

      it("should format string order total", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          orderTotal: "789.12",
        };

        await sendOrderNotificationToAdmin(orderData);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("$789.12");
      });

      it("should handle invalid order total", async () => {
        const orderData = {
          ...baseOrderData,
          orderType: "catering" as const,
          orderTotal: "invalid",
        };

        await sendOrderNotificationToAdmin(orderData);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("$0.00");
      });
    });
  });

  // ============================================================================
  // sendOrderConfirmationToCustomer Tests
  // ============================================================================

  describe("sendOrderConfirmationToCustomer", () => {
    const baseConfirmationData = {
      orderNumber: "ORD-98765",
      customerName: "Jane Customer",
      customerEmail: "jane@example.com",
      pickupTime: new Date("2025-01-20T09:00:00"),
      arrivalTime: new Date("2025-01-20T11:00:00"),
      orderTotal: 250.75,
      pickupAddress: {
        street1: "789 Restaurant St",
        city: "Los Angeles",
        state: "CA",
        zip: "90003",
      },
      deliveryAddress: {
        street1: "321 Office Blvd",
        street2: "Floor 5",
        city: "Los Angeles",
        state: "CA",
        zip: "90004",
      },
    };

    describe("Catering Confirmation", () => {
      it("should send catering order confirmation to customer", async () => {
        const confirmationData = {
          ...baseConfirmationData,
          orderType: "catering" as const,
        };

        const result = await sendOrderConfirmationToCustomer(confirmationData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          to: confirmationData.customerEmail,
          subject: "Order Confirmation - ORD-98765",
        });

        expectEmailContains(mockResendClient.emails.send, [
          confirmationData.orderNumber,
          confirmationData.customerName,
          "Catering",
        ]);
      });
    });

    describe("On-Demand Confirmation", () => {
      it("should send on-demand order confirmation to customer", async () => {
        const confirmationData = {
          ...baseConfirmationData,
          orderType: "on_demand" as const,
        };

        const result = await sendOrderConfirmationToCustomer(confirmationData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          to: confirmationData.customerEmail,
          subject: "Order Confirmation - ORD-98765",
        });

        expectEmailContains(mockResendClient.emails.send, [
          "On-Demand Delivery",
        ]);
      });
    });

    describe("Content Validation", () => {
      it("should include order summary information", async () => {
        const confirmationData = {
          ...baseConfirmationData,
          orderType: "catering" as const,
        };

        await sendOrderConfirmationToCustomer(confirmationData);

        expectEmailContains(mockResendClient.emails.send, [
          "Order Summary",
          "Order Number",
          "Order Total",
          "$250.75",
        ]);
      });

      it("should include delivery information", async () => {
        const confirmationData = {
          ...baseConfirmationData,
          orderType: "catering" as const,
        };

        await sendOrderConfirmationToCustomer(confirmationData);

        expectEmailContains(mockResendClient.emails.send, [
          "Delivery Information",
          "Pickup Address",
          "Delivery Address",
        ]);
      });

      it("should include CTA to view order status", async () => {
        const confirmationData = {
          ...baseConfirmationData,
          orderType: "catering" as const,
        };

        await sendOrderConfirmationToCustomer(confirmationData);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("View Order Status");
        expect(lastCall.html).toContain("/dashboard/orders");
      });
    });

    describe("Date/Time Formatting", () => {
      it("should format pickup and arrival times", async () => {
        const confirmationData = {
          ...baseConfirmationData,
          orderType: "catering" as const,
        };

        const result = await sendOrderConfirmationToCustomer(confirmationData);

        expect(result).toBe(true);
        expect(mockResendClient.emails.send).toHaveBeenCalled();
      });

      it("should handle null times gracefully", async () => {
        const confirmationData = {
          ...baseConfirmationData,
          orderType: "catering" as const,
          pickupTime: null,
          arrivalTime: null,
        };

        const result = await sendOrderConfirmationToCustomer(confirmationData);

        expect(result).toBe(true);
        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("N/A");
      });
    });

    describe("Order Total Formatting", () => {
      it("should format numeric order total", async () => {
        const confirmationData = {
          ...baseConfirmationData,
          orderType: "catering" as const,
          orderTotal: 999.99,
        };

        await sendOrderConfirmationToCustomer(confirmationData);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("$999.99");
      });

      it("should format string order total", async () => {
        const confirmationData = {
          ...baseConfirmationData,
          orderType: "catering" as const,
          orderTotal: "1234.50",
        };

        await sendOrderConfirmationToCustomer(confirmationData);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("$1234.50");
      });
    });

    describe("Error Handling", () => {
      it("should handle missing RESEND_API_KEY gracefully", async () => {
        delete process.env.RESEND_API_KEY;

        const confirmationData = {
          ...baseConfirmationData,
          orderType: "catering" as const,
        };

        const result = await sendOrderConfirmationToCustomer(confirmationData);

        expect(result).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Resend client not available")
        );
      });

      it("should handle Resend API errors", async () => {
        const failingClient = createFailingResendClient();
        const { Resend } = require("resend");
        Resend.mockImplementation(() => failingClient);

        const confirmationData = {
          ...baseConfirmationData,
          orderType: "catering" as const,
        };

        const result = await sendOrderConfirmationToCustomer(confirmationData);

        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Lazy Initialization Tests
  // ============================================================================

  describe("Lazy Initialization", () => {
    it("should not throw error at import time without API key", () => {
      delete process.env.RESEND_API_KEY;

      // Should not throw during module import
      expect(() => {
        jest.isolateModules(() => {
          require("../email-notification");
        });
      }).not.toThrow();
    });

    it("should initialize Resend client only when needed", async () => {
      const userData = {
        email: "user@example.com",
        name: "Test User",
        userType: "client" as const,
      };

      await sendUserWelcomeEmail(userData);

      // Resend should be instantiated
      const { Resend } = require("resend");
      expect(Resend).toHaveBeenCalled();
    });
  });
});
