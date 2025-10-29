/**
 * Unit Tests for Email Service Library
 *
 * Tests the EmailService class that handles logistics/quote request form submissions.
 *
 * Coverage areas:
 * - Form submission notification generation
 * - Address formatting
 * - Specification formatting (nested objects, arrays)
 * - camelCase to Title Case conversion
 * - HTML content generation
 * - Error handling
 * - Lazy initialization
 */

import { EmailService } from "../email-service";
import {
  FormType,
  DeliveryFormData,
} from "@/components/Logistics/QuoteRequest/types";
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

describe("EmailService", () => {
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

  describe("sendFormSubmissionNotification", () => {
    const baseFormData: DeliveryFormData = {
      companyName: "Test Company Inc",
      contactName: "John Doe",
      email: "john@testcompany.com",
      phone: "(555) 123-4567",
      website: "https://testcompany.com",
      counties: ["Los Angeles", "Orange"],
      additionalComments: "Please contact me ASAP",
      pickupAddress: {
        street: "123 Main St",
        city: "Los Angeles",
        state: "CA",
        zip: "90001",
      },
    };

    describe("Successful Email Sending", () => {
      it("should send catering form submission notification", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            numberOfPeople: "50",
            eventType: "Corporate Meeting",
          },
          submissionId: "SUB-12345",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expect(mockResendClient.emails.send).toHaveBeenCalled();

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.subject).toBe("New Catering Delivery Quote Request - Test Company Inc");
        expect(lastCall.from).toBe("Ready Set Website <updates@updates.readysetllc.com>");

        // Verify content includes form type and contact info
        expectEmailContains(mockResendClient.emails.send, [
          "New Catering Delivery Quote Request",
          "SUB-12345",
          "Test Company Inc",
          "John Doe",
          "john@testcompany.com",
        ]);
      });

      it("should send delivery form submission notification", async () => {
        const data = {
          formType: "delivery" as FormType,
          formData: {
            ...baseFormData,
            vehicleType: "Van",
            weight: "100 lbs",
          },
          submissionId: "SUB-67890",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expect(mockResendClient.emails.send).toHaveBeenCalled();

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.subject).toBe("New Delivery Delivery Quote Request - Test Company Inc");
      });

      it("should send on_demand form submission notification", async () => {
        const data = {
          formType: "on_demand" as FormType,
          formData: {
            ...baseFormData,
            urgency: "High",
          },
          submissionId: "SUB-11111",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expect(mockResendClient.emails.send).toHaveBeenCalled();

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.subject).toBe("New On_demand Delivery Quote Request - Test Company Inc");
      });
    });

    describe("Address Formatting", () => {
      it("should format complete pickup address correctly", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            pickupAddress: {
              street: "456 Oak Ave",
              city: "San Francisco",
              state: "CA",
              zip: "94102",
            },
          },
          submissionId: "SUB-ADDR1",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, [
          "456 Oak Ave",
          "San Francisco",
          "CA",
          "94102",
        ]);
      });

      it("should handle missing pickup address fields", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            pickupAddress: {
              street: "123 Main St",
              city: "",
              state: "CA",
              zip: "",
            },
          },
          submissionId: "SUB-ADDR2",
        };

        await EmailService.sendFormSubmissionNotification(data);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("123 Main St");
        expect(lastCall.html).toContain("CA");
      });

      it("should handle undefined pickup address", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            pickupAddress: undefined,
          },
          submissionId: "SUB-ADDR3",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, ["N/A"]);
      });

      it("should filter out 'undefined' strings in address", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            pickupAddress: {
              street: "undefined",
              city: "Los Angeles",
              state: "CA",
              zip: "90001",
            },
          },
          submissionId: "SUB-ADDR4",
        };

        await EmailService.sendFormSubmissionNotification(data);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        // Should not contain the string "undefined"
        expect(lastCall.html).toContain("Los Angeles");
        expect(lastCall.html).not.toContain("undefined, Los Angeles");
      });
    });

    describe("Specification Formatting", () => {
      it("should format simple specification values", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            numberOfPeople: "75",
            eventType: "Wedding",
            setupRequired: "Yes",
          },
          submissionId: "SUB-SPEC1",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, [
          "Number Of People",
          "75",
          "Event Type",
          "Wedding",
          "Setup Required",
          "Yes",
        ]);
      });

      it("should format array specification values", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            services: ["Delivery", "Setup", "Cleanup"],
          },
          submissionId: "SUB-SPEC2",
        };

        await EmailService.sendFormSubmissionNotification(data);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("Delivery, Setup, Cleanup");
      });

      it("should format nested object specification values", async () => {
        const data = {
          formType: "delivery" as FormType,
          formData: {
            ...baseFormData,
            dimensions: {
              length: "24",
              width: "18",
              height: "12",
            },
          },
          submissionId: "SUB-SPEC3",
        };

        await EmailService.sendFormSubmissionNotification(data);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toContain("length: 24");
        expect(lastCall.html).toContain("width: 18");
        expect(lastCall.html).toContain("height: 12");
      });

      it("should handle null and undefined specification values", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            setupTime: null,
            teardownTime: undefined,
          },
          submissionId: "SUB-SPEC4",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, ["N/A"]);
      });

      it("should convert camelCase to Title Case", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            estimatedBudget: "$5000",
            preferredDeliveryTime: "2:00 PM",
            specialDietaryRequirements: "Vegan",
          },
          submissionId: "SUB-SPEC5",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, [
          "Estimated Budget",
          "Preferred Delivery Time",
          "Special Dietary Requirements",
        ]);
      });
    });

    describe("Contact Information", () => {
      it("should include all contact information", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: baseFormData,
          submissionId: "SUB-CONTACT1",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, [
          "Contact Information",
          "Test Company Inc",
          "John Doe",
          "john@testcompany.com",
          "(555) 123-4567",
          "https://testcompany.com",
        ]);
      });

      it("should handle missing optional contact fields", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            companyName: "",
            website: "",
          },
          submissionId: "SUB-CONTACT2",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, ["N/A"]);
      });
    });

    describe("Delivery Details", () => {
      it("should include counties information", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            counties: ["Los Angeles", "Orange", "San Diego"],
          },
          submissionId: "SUB-DELIVERY1",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, [
          "Delivery Details",
          "Los Angeles, Orange, San Diego",
        ]);
      });

      it("should handle empty counties array", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            counties: [],
          },
          submissionId: "SUB-DELIVERY2",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, ["N/A"]);
      });

      it("should handle undefined counties", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            counties: undefined,
          },
          submissionId: "SUB-DELIVERY3",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, ["N/A"]);
      });
    });

    describe("Additional Information", () => {
      it("should include additional comments", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            additionalComments: "This is a very important event. Please handle with extra care.",
          },
          submissionId: "SUB-ADDL1",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, [
          "Additional Information",
          "This is a very important event. Please handle with extra care.",
        ]);
      });

      it("should handle missing additional comments", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            additionalComments: "",
          },
          submissionId: "SUB-ADDL2",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, [
          "No additional comments provided",
        ]);
      });
    });

    describe("Email Format", () => {
      it("should include both HTML and plain text versions", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: baseFormData,
          submissionId: "SUB-FORMAT1",
        };

        await EmailService.sendFormSubmissionNotification(data);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html).toBeDefined();
        expect(lastCall.text).toBeDefined();

        // Plain text should not contain HTML tags
        expect(lastCall.text).not.toContain("<h2>");
        expect(lastCall.text).not.toContain("<ul>");
      });

      it("should format subject line correctly with form type", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            companyName: "ABC Corporation",
          },
          submissionId: "SUB-FORMAT2",
        };

        await EmailService.sendFormSubmissionNotification(data);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.subject).toBe("New Catering Delivery Quote Request - ABC Corporation");
      });

      it("should send to configured notification recipient", async () => {
        process.env.NOTIFICATION_RECIPIENT = "admin@testcompany.com";

        const data = {
          formType: "catering" as FormType,
          formData: baseFormData,
          submissionId: "SUB-FORMAT3",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailSent(mockResendClient.emails.send, {
          to: "admin@testcompany.com",
        });
      });

      it("should use default recipient if not configured", async () => {
        delete process.env.NOTIFICATION_RECIPIENT;

        const data = {
          formType: "catering" as FormType,
          formData: baseFormData,
          submissionId: "SUB-FORMAT4",
        };

        await EmailService.sendFormSubmissionNotification(data);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.to).toBe("info@ready-set.co");
      });
    });

    describe("Error Handling", () => {
      it("should handle missing RESEND_API_KEY gracefully", async () => {
        delete process.env.RESEND_API_KEY;

        const data = {
          formType: "catering" as FormType,
          formData: baseFormData,
          submissionId: "SUB-ERROR1",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expect(consoleWarnSpy).toHaveBeenCalledWith("RESEND_API_KEY not configured");
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Resend client not available")
        );
        expect(mockResendClient.emails.send).not.toHaveBeenCalled();
      });

      it("should throw error when Resend API fails", async () => {
        const failingClient = createFailingResendClient({
          statusCode: 500,
          message: "Internal Server Error",
        });

        const { Resend } = require("resend");
        Resend.mockImplementation(() => failingClient);

        const data = {
          formType: "catering" as FormType,
          formData: baseFormData,
          submissionId: "SUB-ERROR2",
        };

        await expect(EmailService.sendFormSubmissionNotification(data)).rejects.toEqual({
          statusCode: 500,
          message: "Internal Server Error",
          name: "ResendError",
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error sending notification email:",
          expect.anything()
        );
      });

      it("should handle network timeout", async () => {
        const timeoutClient = createFailingResendClient({
          statusCode: 504,
          message: "Gateway Timeout",
          name: "TimeoutError",
        });

        const { Resend } = require("resend");
        Resend.mockImplementation(() => timeoutClient);

        const data = {
          formType: "catering" as FormType,
          formData: baseFormData,
          submissionId: "SUB-ERROR3",
        };

        await expect(EmailService.sendFormSubmissionNotification(data)).rejects.toEqual({
          statusCode: 504,
          message: "Gateway Timeout",
          name: "TimeoutError",
        });
      });
    });

    describe("Lazy Initialization", () => {
      it("should not throw error at import time without API key", () => {
        delete process.env.RESEND_API_KEY;

        // Should not throw during module import
        expect(() => {
          jest.isolateModules(() => {
            require("../email-service");
          });
        }).not.toThrow();
      });

      it("should initialize Resend client only when needed", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: baseFormData,
          submissionId: "SUB-LAZY1",
        };

        await EmailService.sendFormSubmissionNotification(data);

        // Resend should be instantiated
        const { Resend } = require("resend");
        expect(Resend).toHaveBeenCalled();
      });
    });

    describe("Edge Cases", () => {
      it("should handle null form type", async () => {
        const data = {
          formType: null as any,
          formData: baseFormData,
          submissionId: "SUB-EDGE1",
        };

        await EmailService.sendFormSubmissionNotification(data);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.subject).toContain("Unknown");
      });

      it("should handle empty specifications", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            // No additional specifications
          },
          submissionId: "SUB-EDGE2",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expect(mockResendClient.emails.send).toHaveBeenCalled();
      });

      it("should handle very long specification values", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            specialRequirements: "A".repeat(5000),
          },
          submissionId: "SUB-EDGE3",
        };

        await EmailService.sendFormSubmissionNotification(data);

        const lastCall = mockResendClient.emails.send.mock.calls[mockResendClient.emails.send.mock.calls.length - 1][0];
        expect(lastCall.html.length).toBeGreaterThan(5000);
      });

      it("should handle special characters in input", async () => {
        const data = {
          formType: "catering" as FormType,
          formData: {
            ...baseFormData,
            companyName: "Test & Company <Special> Chars",
            additionalComments: "Quote: \"Important\" & 'Critical'",
          },
          submissionId: "SUB-EDGE4",
        };

        await EmailService.sendFormSubmissionNotification(data);

        expectEmailContains(mockResendClient.emails.send, [
          "Test & Company <Special> Chars",
          "Quote: \"Important\" & 'Critical'",
        ]);
      });
    });
  });
});
