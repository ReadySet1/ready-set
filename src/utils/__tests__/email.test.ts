/**
 * Unit Tests for Email Utility
 *
 * Tests the generic sendEmail utility function.
 *
 * Coverage areas:
 * - Successful email sending
 * - Error handling (no API key, Resend errors)
 * - Response handling
 * - Lazy initialization
 * - FROM address configuration
 */

import { sendEmail } from "../email";
import {
  createMockResendClient,
  createFailingResendClient,
  createUnauthorizedResendClient,
  setupEmailTestEnv,
  clearEmailTestEnv,
} from "@/__tests__/helpers/email-test-helpers";

// Mock Resend
jest.mock("resend");

describe("sendEmail", () => {
  let mockResendClient: ReturnType<typeof createMockResendClient>;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup test environment
    setupEmailTestEnv();

    // Create fresh mock for each test
    mockResendClient = createMockResendClient();

    // Mock the Resend constructor
    const { Resend } = require("resend");
    Resend.mockImplementation(() => mockResendClient);

    // Spy on console methods
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    clearEmailTestEnv();
  });

  describe("Successful Email Sending", () => {
    it("should send email with valid payload", async () => {
      const emailData = {
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<h1>Test Email</h1><p>This is a test</p>",
      };

      const response = await sendEmail(emailData);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith({
        to: emailData.to,
        from: process.env.EMAIL_FROM,
        subject: emailData.subject,
        html: emailData.html,
      });

      expect(response).toEqual({
        id: "test-email-id-123",
        from: "noreply@updates.readysetllc.com",
        to: "test@example.com",
        created_at: expect.any(String),
      });
    });

    it("should use configured FROM address", async () => {
      process.env.EMAIL_FROM = "custom@example.com";

      const emailData = {
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      };

      await sendEmail(emailData);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "custom@example.com",
        })
      );
    });

    it("should use default FROM address if not configured", async () => {
      delete process.env.EMAIL_FROM;

      const emailData = {
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      };

      await sendEmail(emailData);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "noreply@updates.readysetllc.com",
        })
      );
    });

    it("should send email with HTML content", async () => {
      const emailData = {
        to: "recipient@example.com",
        subject: "HTML Test",
        html: `
          <html>
            <body>
              <h1>Welcome</h1>
              <p>This is an HTML email</p>
            </body>
          </html>
        `,
      };

      const response = await sendEmail(emailData);

      expect(response).toBeDefined();
      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("<h1>Welcome</h1>"),
        })
      );
    });

    it("should return response from Resend", async () => {
      const customResponse = {
        id: "custom-email-id",
        from: "test@example.com",
        to: "recipient@example.com",
        created_at: "2025-01-01T00:00:00Z",
      };

      mockResendClient = createMockResendClient(customResponse);
      const { Resend } = require("resend");
      Resend.mockImplementation(() => mockResendClient);

      const emailData = {
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      };

      const response = await sendEmail(emailData);

      expect(response).toEqual(customResponse);
    });
  });

  describe("Error Handling", () => {
    it("should throw error when RESEND_API_KEY is missing", async () => {
      delete process.env.RESEND_API_KEY;

      const emailData = {
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      };

      await expect(sendEmail(emailData)).rejects.toThrow(
        "Email service not configured"
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith("RESEND_API_KEY not configured");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Resend client not available")
      );
    });

    it("should throw error when Resend API fails", async () => {
      const failingClient = createFailingResendClient({
        statusCode: 500,
        message: "Internal Server Error",
      });

      const { Resend } = require("resend");
      Resend.mockImplementation(() => failingClient);

      const emailData = {
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      };

      await expect(sendEmail(emailData)).rejects.toEqual({
        statusCode: 500,
        message: "Internal Server Error",
        name: "ResendError",
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error sending email:",
        expect.anything()
      );
    });

    it("should throw error on unauthorized API key", async () => {
      const unauthorizedClient = createUnauthorizedResendClient();

      const { Resend } = require("resend");
      Resend.mockImplementation(() => unauthorizedClient);

      const emailData = {
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      };

      await expect(sendEmail(emailData)).rejects.toEqual({
        statusCode: 401,
        message: "Invalid API key",
        name: "UnauthorizedError",
      });
    });

    it("should log error response body if available", async () => {
      const errorWithResponse = {
        statusCode: 400,
        message: "Bad Request",
        name: "ValidationError",
        response: {
          body: { error: "Invalid email address" },
        },
      };

      const failingClient = {
        emails: {
          send: jest.fn().mockRejectedValue(errorWithResponse),
        },
      };

      const { Resend } = require("resend");
      Resend.mockImplementation(() => failingClient);

      const emailData = {
        to: "invalid-email",
        subject: "Test",
        html: "<p>Test</p>",
      };

      await expect(sendEmail(emailData)).rejects.toEqual(errorWithResponse);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error sending email:",
        expect.anything()
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        errorWithResponse.response.body
      );
    });

    it("should handle network timeout", async () => {
      const timeoutError = {
        statusCode: 504,
        message: "Gateway Timeout",
        name: "TimeoutError",
      };

      const failingClient = {
        emails: {
          send: jest.fn().mockRejectedValue(timeoutError),
        },
      };

      const { Resend } = require("resend");
      Resend.mockImplementation(() => failingClient);

      const emailData = {
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      };

      await expect(sendEmail(emailData)).rejects.toEqual(timeoutError);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty subject", async () => {
      const emailData = {
        to: "recipient@example.com",
        subject: "",
        html: "<p>Test</p>",
      };

      await sendEmail(emailData);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "",
        })
      );
    });

    it("should handle empty HTML content", async () => {
      const emailData = {
        to: "recipient@example.com",
        subject: "Test",
        html: "",
      };

      await sendEmail(emailData);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "",
        })
      );
    });

    it("should handle special characters in subject", async () => {
      const emailData = {
        to: "recipient@example.com",
        subject: "Test <Special> & \"Characters\"",
        html: "<p>Test</p>",
      };

      await sendEmail(emailData);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Test <Special> & \"Characters\"",
        })
      );
    });

    it("should handle very long HTML content", async () => {
      const emailData = {
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>" + "A".repeat(50000) + "</p>",
      };

      await sendEmail(emailData);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("A".repeat(50000)),
        })
      );
    });

    it("should handle multiple recipients (single string)", async () => {
      const emailData = {
        to: "recipient1@example.com, recipient2@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      };

      await sendEmail(emailData);

      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "recipient1@example.com, recipient2@example.com",
        })
      );
    });
  });

  describe("Lazy Initialization", () => {
    it("should not throw error at import time without API key", () => {
      delete process.env.RESEND_API_KEY;

      // Should not throw during module import
      expect(() => {
        jest.isolateModules(() => {
          require("../email");
        });
      }).not.toThrow();
    });

    it("should initialize Resend client only when called", async () => {
      const emailData = {
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      };

      await sendEmail(emailData);

      // Resend should be instantiated
      const { Resend } = require("resend");
      expect(Resend).toHaveBeenCalled();
    });

    it("should reuse Resend client across multiple calls", async () => {
      const emailData1 = {
        to: "recipient1@example.com",
        subject: "Test 1",
        html: "<p>Test 1</p>",
      };

      const emailData2 = {
        to: "recipient2@example.com",
        subject: "Test 2",
        html: "<p>Test 2</p>",
      };

      await sendEmail(emailData1);
      await sendEmail(emailData2);

      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(2);
    });
  });
});
