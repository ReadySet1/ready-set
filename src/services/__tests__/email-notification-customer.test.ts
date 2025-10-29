/**
 * Unit Tests for Email Notification Service - Customer Confirmations
 *
 * Tests sendOrderConfirmationToCustomer function:
 * - Catering order confirmations
 * - On-demand order confirmations
 * - Content validation (order summary, delivery info, CTA)
 * - Date/time and currency formatting
 * - Error handling
 *
 * Coverage areas:
 * - Successful email sending for both order types
 * - Error handling (no API key, network failures)
 * - Content formatting and validation
 * - Edge cases (missing fields, null values)
 */

import { sendOrderConfirmationToCustomer } from "../email-notification";
import {
  createMockResendClient,
  createFailingResendClient,
  expectEmailSent,
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

describe("Email Notification Service - Customer Confirmations", () => {
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
});
