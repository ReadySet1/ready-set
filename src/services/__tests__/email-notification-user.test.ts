/**
 * Unit Tests for Email Notification Service - User Welcome Emails
 *
 * Tests sendUserWelcomeEmail function:
 * - All 6 user roles (client, vendor, driver, helpdesk, admin, super_admin)
 * - Self-registration vs admin-created account scenarios
 * - Template generation and content validation
 * - Error handling and lazy initialization
 *
 * Coverage areas:
 * - Successful email sending for all user types
 * - Error handling (no API key, network failures)
 * - Template generation with role-specific content
 * - Lazy initialization patterns
 */

import { UserType } from "@prisma/client";
import { sendUserWelcomeEmail } from "../email-notification";
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

describe("Email Notification Service - User Welcome", () => {
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

        // Note: logging happens in the resilience wrapper, not the service itself
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

      it("should include vendor details in confirmation email (REA-104)", async () => {
        const userData = {
          email: "vendor@example.com",
          name: "Jane Vendor",
          userType: "vendor" as const,
          isAdminCreated: false,
          vendorDetails: {
            companyName: "Best Catering Co",
            contactName: "Jane Vendor",
            phoneNumber: "555-123-4567",
            address: {
              street1: "123 Main Street",
              street2: "Suite 100",
              city: "Austin",
              state: "TX",
              zip: "78701",
            },
            countiesServed: ["Travis", "Williamson", "Hays"],
            timeNeeded: ["Breakfast", "Lunch", "Dinner"],
            frequency: "Daily",
            website: "https://bestcatering.co",
            cateringBrokerage: ["EZCater", "CaterValley"],
            provisions: ["Setup", "Delivery", "Cleanup"],
          },
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(true);
        expectEmailSent(mockResendClient.emails.send, {
          to: userData.email,
          subject: "Welcome to Ready Set - Your Vendor Account is Ready!",
        });

        // Verify vendor details are included in email content
        expectEmailContains(mockResendClient.emails.send, [
          "Best Catering Co",
          "Jane Vendor",
          "555-123-4567",
          "123 Main Street",
          "Austin",
          "TX",
          "78701",
          "Travis",
          "Breakfast",
          "Daily",
          "EZCater",
          "Setup",
        ]);
      });

      it("should handle vendor registration without optional details", async () => {
        const userData = {
          email: "vendor@example.com",
          name: "Simple Vendor",
          userType: "vendor" as const,
          isAdminCreated: false,
          vendorDetails: {
            companyName: "Simple Restaurant",
            contactName: "Simple Vendor",
            phoneNumber: "555-999-8888",
            address: {
              street1: "456 Oak Avenue",
              city: "Dallas",
              state: "TX",
              zip: "75001",
            },
            // Optional fields not provided
          },
        };

        const result = await sendUserWelcomeEmail(userData);

        expect(result).toBe(true);
        expectEmailContains(mockResendClient.emails.send, [
          "Simple Restaurant",
          "Simple Vendor",
          "555-999-8888",
          "456 Oak Avenue",
          "Dallas",
        ]);
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
