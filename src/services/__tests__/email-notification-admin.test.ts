/**
 * Unit Tests for Email Notification Service - Admin Notifications
 *
 * Tests sendOrderNotificationToAdmin function:
 * - Catering order notifications
 * - On-demand order notifications
 * - Address formatting and validation
 * - Date/time and currency formatting
 * - Optional field handling
 *
 * Coverage areas:
 * - Successful email sending for both order types
 * - Error handling (no API key, network failures)
 * - Content formatting and validation
 * - Edge cases (missing fields, null values)
 */

import { sendOrderNotificationToAdmin } from "../email-notification";
import {
  createMockResendClient,
  createFailingResendClient,
  expectEmailContains,
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

describe("Email Notification Service - Admin Notifications", () => {
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
});
