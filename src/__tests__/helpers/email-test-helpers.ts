/**
 * Email Testing Helpers
 *
 * This module provides reusable utilities for testing email services.
 * It includes helpers for mocking Resend, validating email content,
 * and creating test data for email scenarios.
 */

import { UserType } from "@prisma/client";
import * as cheerio from "cheerio";

// ============================================================================
// Type Definitions
// ============================================================================

export interface MockResendResponse {
  id: string;
  from: string;
  to: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  created_at?: string;
}

export interface MockResendError {
  statusCode: number;
  message: string;
  name: string;
}

export interface EmailTestData {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  pickupAddress: string;
  deliveryAddress: string;
  orderType: "catering" | "on_demand";
  totalAmount?: number;
}

export interface UserEmailData {
  email: string;
  name: string;
  role: UserType;
  temporaryPassword?: string;
  isAdminCreated?: boolean;
}

// ============================================================================
// Resend Mock Factory
// ============================================================================

/**
 * Creates a mock Resend client with configurable responses
 * @param overrides - Optional overrides for the mock response
 * @returns Mock Resend client
 */
export const createMockResendClient = (
  overrides: Partial<MockResendResponse> = {}
) => {
  const defaultResponse: MockResendResponse = {
    id: "test-email-id-123",
    from: "noreply@updates.readysetllc.com",
    to: "test@example.com",
    created_at: new Date().toISOString(),
    ...overrides,
  };

  return {
    emails: {
      send: jest.fn().mockResolvedValue(defaultResponse),
    },
  };
};

/**
 * Creates a mock Resend client that fails with an error
 * @param error - The error to throw
 * @returns Mock Resend client that rejects
 */
export const createFailingResendClient = (
  error: Partial<MockResendError> = {}
) => {
  const defaultError: MockResendError = {
    statusCode: 500,
    message: "Internal Server Error",
    name: "ResendError",
    ...error,
  };

  return {
    emails: {
      send: jest.fn().mockRejectedValue(defaultError),
    },
  };
};

/**
 * Creates a mock Resend client with rate limiting error
 * @returns Mock Resend client that rejects with rate limit error
 */
export const createRateLimitedResendClient = () => {
  return createFailingResendClient({
    statusCode: 429,
    message: "Too Many Requests",
    name: "RateLimitError",
  });
};

/**
 * Creates a mock Resend client with invalid API key error
 * @returns Mock Resend client that rejects with auth error
 */
export const createUnauthorizedResendClient = () => {
  return createFailingResendClient({
    statusCode: 401,
    message: "Invalid API key",
    name: "UnauthorizedError",
  });
};

// ============================================================================
// Email Assertion Helpers
// ============================================================================

/**
 * Asserts that an email was sent with the expected parameters
 * @param mockSend - The mocked send function
 * @param expected - Expected email data
 */
export const expectEmailSent = (
  mockSend: jest.Mock,
  expected: Partial<EmailTestData>
) => {
  expect(mockSend).toHaveBeenCalled();

  const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1][0];

  if (expected.to) {
    if (Array.isArray(expected.to)) {
      expect(lastCall.to).toEqual(expect.arrayContaining(expected.to));
    } else {
      expect(lastCall.to).toBe(expected.to);
    }
  }

  if (expected.from) {
    expect(lastCall.from).toBe(expected.from);
  }

  if (expected.subject) {
    expect(lastCall.subject).toBe(expected.subject);
  }

  if (expected.html) {
    expect(lastCall.html).toContain(expected.html);
  }

  if (expected.replyTo) {
    expect(lastCall.replyTo).toBe(expected.replyTo);
  }
};

/**
 * Asserts that an email was NOT sent
 * @param mockSend - The mocked send function
 */
export const expectEmailNotSent = (mockSend: jest.Mock) => {
  expect(mockSend).not.toHaveBeenCalled();
};

/**
 * Asserts that an email was sent to specific recipients
 * @param mockSend - The mocked send function
 * @param recipients - Expected recipients
 */
export const expectEmailSentTo = (
  mockSend: jest.Mock,
  recipients: string | string[]
) => {
  expect(mockSend).toHaveBeenCalled();

  const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1][0];

  if (Array.isArray(recipients)) {
    expect(lastCall.to).toEqual(expect.arrayContaining(recipients));
  } else {
    expect(lastCall.to).toBe(recipients);
  }
};

/**
 * Asserts that email HTML contains specific content
 * @param mockSend - The mocked send function
 * @param content - Expected content snippets
 */
export const expectEmailContains = (
  mockSend: jest.Mock,
  content: string | string[]
) => {
  expect(mockSend).toHaveBeenCalled();

  const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1][0];
  const html = lastCall.html;

  if (Array.isArray(content)) {
    content.forEach((snippet) => {
      expect(html).toContain(snippet);
    });
  } else {
    expect(html).toContain(content);
  }
};

/**
 * Asserts that email was sent exactly N times
 * @param mockSend - The mocked send function
 * @param times - Expected number of calls
 */
export const expectEmailSentTimes = (mockSend: jest.Mock, times: number) => {
  expect(mockSend).toHaveBeenCalledTimes(times);
};

// ============================================================================
// HTML Validation Helpers
// ============================================================================

/**
 * Validates that HTML contains proper structure
 * @param html - HTML string to validate
 */
export const validateEmailHtml = (html: string) => {
  // Check for basic HTML structure
  expect(html).toContain("<html");
  expect(html).toContain("</html>");
  expect(html).toContain("<body");
  expect(html).toContain("</body>");
};

/**
 * Validates that HTML contains brand elements
 * @param html - HTML string to validate
 */
export const validateBrandElements = (html: string) => {
  // Check for brand colors or styles
  expect(html).toMatch(/color:\s*#[0-9A-Fa-f]{6}|rgb\(/);

  // Check for company name or branding
  expect(html.toLowerCase()).toMatch(/ready[\s-]?set/);
};

/**
 * Validates that HTML is properly escaped/sanitized
 * @param html - HTML string to validate
 */
export const validateHtmlSanitization = (html: string) => {
  // Check that no dangerous script tags exist
  expect(html.toLowerCase()).not.toContain("<script");

  // Check that special characters are properly encoded
  if (html.includes("&")) {
    expect(html).toMatch(/&[a-z]+;|&#\d+;/);
  }
};

/**
 * Validates that HTML contains a CTA button
 * @param html - HTML string to validate
 * @param buttonText - Expected button text
 */
export const validateCtaButton = (html: string, buttonText?: string) => {
  expect(html).toMatch(/<a[^>]*>.*<\/a>/);

  if (buttonText) {
    expect(html).toContain(buttonText);
  }
};

/**
 * Validates that HTML contains proper responsive design
 * @param html - HTML string to validate
 */
export const validateResponsiveDesign = (html: string) => {
  // Check for viewport meta tag or responsive styles
  expect(html).toMatch(/viewport|max-width|@media/);
};

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Creates test data for order email
 * @param overrides - Optional overrides
 * @returns Order email test data
 */
export const createOrderEmailData = (
  overrides: Partial<OrderEmailData> = {}
): OrderEmailData => {
  return {
    orderNumber: "TEST-001",
    customerName: "Test Customer",
    customerEmail: "customer@example.com",
    pickupAddress: "123 Pickup St, Los Angeles, CA 90001",
    deliveryAddress: "456 Delivery Ave, Los Angeles, CA 90002",
    orderType: "catering",
    totalAmount: 100.0,
    ...overrides,
  };
};

/**
 * Creates test data for user welcome email
 * @param overrides - Optional overrides
 * @returns User email test data
 */
export const createUserEmailData = (
  overrides: Partial<UserEmailData> = {}
): UserEmailData => {
  return {
    email: "user@example.com",
    name: "Test User",
    role: UserType.CLIENT,
    isAdminCreated: false,
    ...overrides,
  };
};

/**
 * Creates test data for admin-created user email
 * @param overrides - Optional overrides
 * @returns User email test data with temporary password
 */
export const createAdminCreatedUserEmailData = (
  overrides: Partial<UserEmailData> = {}
): UserEmailData => {
  return {
    email: "newuser@example.com",
    name: "New User",
    role: UserType.CLIENT,
    temporaryPassword: "TempPass123!",
    isAdminCreated: true,
    ...overrides,
  };
};

/**
 * Creates multiple recipient email data
 * @param count - Number of recipients
 * @returns Array of email addresses
 */
export const createMultipleRecipients = (count: number = 3): string[] => {
  return Array.from(
    { length: count },
    (_, i) => `recipient${i + 1}@example.com`
  );
};

// ============================================================================
// Environment Configuration Helpers
// ============================================================================

/**
 * Sets up test environment variables for email testing
 * Also resets the email circuit breaker to ensure clean test state
 */
export const setupEmailTestEnv = () => {
  process.env.RESEND_API_KEY = "test-resend-api-key";
  process.env.EMAIL_FROM = "solutions@updates.readysetllc.com";
  process.env.ADMIN_EMAIL = "admin@test.com";
  process.env.NOTIFICATION_RECIPIENT = "admin@test.com";

  // Reset circuit breaker to ensure clean test state
  try {
    const { emailCircuitBreaker } = require("@/utils/email-resilience");
    if (emailCircuitBreaker && typeof emailCircuitBreaker.reset === "function") {
      emailCircuitBreaker.reset();
    }
  } catch {
    // Circuit breaker module may not be available in all test contexts
  }
};

/**
 * Clears email-related environment variables
 */
export const clearEmailTestEnv = () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.ADMIN_EMAIL;
  delete process.env.NOTIFICATION_RECIPIENT;
};

/**
 * Gets test email configuration
 * @returns Email configuration for tests
 */
export const getTestEmailConfig = () => {
  return {
    apiKey: process.env.RESEND_API_KEY || "test-resend-api-key",
    from: process.env.EMAIL_FROM || "solutions@updates.readysetllc.com",
    adminEmail: process.env.ADMIN_EMAIL || "admin@test.com",
    notificationRecipient:
      process.env.NOTIFICATION_RECIPIENT || "admin@test.com",
  };
};

// ============================================================================
// Email Content Extraction Helpers
// ============================================================================

/**
 * Extracts all links from email HTML
 * @param html - HTML string
 * @returns Array of URLs
 */
export const extractEmailLinks = (html: string): string[] => {
  const linkRegex = /href=["']([^"']+)["']/g;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    links.push(match[1]);
  }

  return links;
};

/**
 * Extracts plain text content from HTML (strips tags)
 * Uses cheerio for secure HTML parsing to prevent XSS vulnerabilities
 * @param html - HTML string
 * @returns Plain text content
 */
export const extractPlainText = (html: string): string => {
  const $ = cheerio.load(html);
  return $.text().trim();
};

/**
 * Gets the last email sent from a mock
 * @param mockSend - The mocked send function
 * @returns The last email sent
 */
export const getLastEmailSent = (mockSend: jest.Mock): EmailTestData | null => {
  if (mockSend.mock.calls.length === 0) {
    return null;
  }

  return mockSend.mock.calls[mockSend.mock.calls.length - 1][0];
};

/**
 * Gets all emails sent from a mock
 * @param mockSend - The mocked send function
 * @returns Array of all emails sent
 */
export const getAllEmailsSent = (mockSend: jest.Mock): EmailTestData[] => {
  return mockSend.mock.calls.map((call) => call[0]);
};
