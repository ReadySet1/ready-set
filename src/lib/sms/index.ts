import type { SmsProvider } from "./types";
import { TwilioSmsProvider } from "./twilio";

export type { SmsProvider, SmsResult } from "./types";

let provider: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (provider) {
    return provider;
  }

  const smsProvider = process.env.SMS_PROVIDER ?? "twilio";

  switch (smsProvider) {
    case "twilio":
      provider = new TwilioSmsProvider();
      break;
    default:
      throw new Error(
        `Unknown SMS provider: ${smsProvider}. Supported: twilio`,
      );
  }

  return provider;
}
