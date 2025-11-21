// src/lib/email/sendgrid.ts
// Centralized SendGrid client + provider-agnostic interface for transactional emails.
// This follows the lazy-initialization pattern used in `src/app/api/leads/route.ts`
// so that local/test environments without SENDGRID_* vars do not break builds.

import type { ClientRequest } from "@sendgrid/client/src/request";
import { Client } from "@sendgrid/client";

export interface EmailContent {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailSendParams {
  to: EmailRecipient;
  from: EmailRecipient;
  content: EmailContent;
  // Optional category or custom args for observability / filtering
  category?: string;
  customArgs?: Record<string, string>;
}

export interface EmailProviderResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

export interface EmailProvider {
  send(params: EmailSendParams): Promise<EmailProviderResult>;
}

interface SendGridClientConfig {
  client: Client;
  senderEmail: string;
  senderName: string;
}

const getSendGridClient = (): SendGridClientConfig | null => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const senderEmail =
    process.env.SENDGRID_SENDER_EMAIL || "noreply@readysetllc.com";
  const senderName = process.env.SENDGRID_SENDER_NAME || "Ready Set";

  if (!apiKey) {
    // In non-configured environments (e.g. local tests), we gracefully no-op.
    console.warn("SendGrid configuration is missing - transactional emails will be skipped");
    return null;
  }

  const client = new Client();
  client.setApiKey(apiKey);

  return {
    client,
    senderEmail,
    senderName,
  };
};

export class SendGridEmailProvider implements EmailProvider {
  async send(params: EmailSendParams): Promise<EmailProviderResult> {
    const config = getSendGridClient();

    if (!config) {
      return {
        success: false,
        error: "SendGrid not configured",
      };
    }

    const { client, senderEmail, senderName } = config;

    const {
      to,
      from,
      content: { subject, html, text },
      category,
      customArgs,
    } = params;

    const request: ClientRequest = {
      url: "/v3/mail/send",
      method: "POST",
      body: {
        personalizations: [
          {
            to: [{ email: to.email, name: to.name }],
            custom_args: customArgs,
            categories: category ? [category] : undefined,
          },
        ],
        from: {
          email: from.email || senderEmail,
          name: from.name || senderName,
        },
        reply_to: {
          email: from.email || senderEmail,
          name: from.name || senderName,
        },
        subject,
        content: [
          {
            type: "text/html",
            value: html,
          },
          {
            type: "text/plain",
            value: text ?? html.replace(/<[^>]*>/g, ""),
          },
        ],
      },
    };

    try {
      const [response] = await client.request(request);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        const headers = response.headers ?? {};
        const messageId =
          (Array.isArray(headers["x-message-id"])
            ? headers["x-message-id"][0]
            : headers["x-message-id"]) || undefined;

        return {
          success: true,
          providerId: typeof messageId === "string" ? messageId : undefined,
        };
      }

      // Non-2xx response: log and surface a safe error message
      console.error("SendGrid send error", {
        statusCode: response.statusCode,
        body: response.body,
      });

      return {
        success: false,
        error: `SendGrid send failed with status ${response.statusCode}`,
      };
    } catch (error) {
      console.error("SendGrid send exception", error);

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while sending email",
      };
    }
  }
}


