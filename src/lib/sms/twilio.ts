import twilio from "twilio";
import type { SmsProvider, SmsResult } from "./types";

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    return digits;
  }

  const numericOnly = digits.replace(/\D/g, "");

  if (numericOnly.length === 10) {
    return `+1${numericOnly}`;
  }

  if (numericOnly.length === 11 && numericOnly.startsWith("1")) {
    return `+${numericOnly}`;
  }

  return `+${numericOnly}`;
}

export class TwilioSmsProvider implements SmsProvider {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !phoneNumber) {
      throw new Error(
        "Missing Twilio configuration. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
      );
    }

    this.client = twilio(accountSid, authToken);
    this.fromNumber = phoneNumber;
  }

  async send(to: string, body: string): Promise<SmsResult> {
    const normalizedTo = normalizePhoneNumber(to);

    try {
      const message = await this.client.messages.create({
        body,
        from: this.fromNumber,
        to: normalizedTo,
      });

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown Twilio error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
