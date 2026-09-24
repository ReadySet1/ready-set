/**
 * sendEmail is a "use server" action behind every public form (contact, join
 * the team, talent pool, catering contact, sign-up notification). Server
 * actions that THROW get their message masked in production, so expected
 * failures (rate limit, spam, validation) must come back as a result object.
 * The limiter bucket is per form type, so filling the contact form five times
 * cannot block the sign-up notification from the same IP.
 */
jest.mock("next/headers", () => ({ headers: jest.fn() }));
jest.mock("@/lib/recaptcha", () => ({ verifyRecaptchaToken: jest.fn() }));
// The global cheerio mock in jest.setup.ts throws when called (it assigns
// `length` onto a function), which would break the registration template.
jest.mock("cheerio", () => ({
  load: jest.fn(() => jest.fn(() => ({ text: () => "" }))),
}));

const mockSend = jest.fn();
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

import { headers } from "next/headers";
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { SpamProtectionManager } from "@/lib/spam-protection";
import sendEmail from "../email";

const mockedHeaders = headers as jest.Mock;
const mockedRecaptcha = verifyRecaptchaToken as jest.Mock;

const CLIENT_IP = "8.8.8.8";

const contactForm = {
  name: "Ana Lopez",
  email: "ana@example.com",
  phone: "4155550100",
  message: "I need catering for 40 people next Friday.",
};

const registrationNotification = {
  name: "vendor@example.com",
  email: "vendor@example.com",
  subject: "New Vendor Registration - Ready Set",
  message:
    "<p>User Type: vendor</p><p>Name: Vendor</p><p>Email: vendor@example.com</p><p>Company: Acme</p>",
};

function resetRateLimits() {
  (
    SpamProtectionManager as unknown as { RATE_LIMITS: Map<string, unknown> }
  ).RATE_LIMITS.clear();
}

describe("sendEmail server action", () => {
  const originalApiKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    process.env.RESEND_API_KEY = "re_test_key";
    mockedHeaders.mockResolvedValue(
      new Map([["x-forwarded-for", CLIENT_IP]]),
    );
    mockSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
    mockedRecaptcha.mockResolvedValue({ success: true, score: 0.9 });
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalApiKey;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    SpamProtectionManager.stopCleanupScheduler();
  });

  it("returns success when the email is sent", async () => {
    const result = await sendEmail(contactForm);

    expect(result).toEqual({
      success: true,
      message: "Your message was sent successfully.",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("returns rate_limited on the 6th submission of the same form from the same IP instead of throwing", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(sendEmail(contactForm)).resolves.toMatchObject({
        success: true,
      });
    }

    const result = await sendEmail(contactForm);

    expect(result).toEqual({
      success: false,
      reason: "rate_limited",
      error: "Too many submissions. Please wait a few minutes and try again.",
    });
    expect(mockSend).toHaveBeenCalledTimes(5);
  });

  it("does not let 5 contact submissions block a registration notification from the same IP", async () => {
    for (let i = 0; i < 5; i++) {
      await sendEmail(contactForm);
    }
    await expect(sendEmail(contactForm)).resolves.toMatchObject({
      success: false,
      reason: "rate_limited",
    });

    const result = await sendEmail(registrationNotification);

    expect(result).toEqual({
      success: true,
      message: "Your message was sent successfully.",
    });
  });

  it("returns validation for messages over 1000 characters", async () => {
    const result = await sendEmail({ ...contactForm, message: "a".repeat(1001) });

    expect(result).toEqual({
      success: false,
      reason: "validation",
      error: "Message cannot exceed 1000 characters.",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns a generic spam error (no spammer feedback) when the honeypot is filled", async () => {
    const result = await sendEmail({ ...contactForm, honeypot: "bot" });

    expect(result).toEqual({
      success: false,
      reason: "spam",
      error:
        "Unable to send message. Please try again later or contact us directly.",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns recaptcha when the token fails verification", async () => {
    mockedRecaptcha.mockResolvedValue({ success: false, score: 0.1 });

    const result = await sendEmail({ ...contactForm, recaptchaToken: "tok" });

    expect(result).toEqual({
      success: false,
      reason: "recaptcha",
      error: "Unable to verify submission. Please try again.",
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns config when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await sendEmail(contactForm);

    expect(result).toMatchObject({ success: false, reason: "config" });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns send_failed with a safe message when the provider throws", async () => {
    mockSend.mockRejectedValue(new Error("resend API exploded: key re_secret"));

    const result = await sendEmail(contactForm);

    expect(result).toMatchObject({ success: false, reason: "send_failed" });
    if (!result.success) {
      expect(result.error).not.toMatch(/re_secret|exploded/);
    }
  });

  it("returns send_failed when Resend reports an error without throwing", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid `from` field" },
    });

    const result = await sendEmail(contactForm);

    expect(result).toMatchObject({ success: false, reason: "send_failed" });
  });
});
