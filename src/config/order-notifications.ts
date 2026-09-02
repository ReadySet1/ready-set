/**
 * Recipient configuration for new-order admin notifications.
 * Single source of truth — do not read ADMIN_EMAIL directly elsewhere.
 *
 * Precedence (first match wins):
 *   1. ORDER_NOTIFICATIONS_ENABLED=false  → disabled, empty recipients.
 *   2. ORDER_NOTIFICATION_RECIPIENTS unset:
 *        production → DEFAULT_ORDER_NOTIFICATION_RECIPIENTS, enabled.
 *        otherwise  → disabled (fail closed).
 *   3. ORDER_NOTIFICATION_RECIPIENTS set but every entry invalid
 *      → disabled, console.error + Sentry.captureMessage.
 *   4. ORDER_NOTIFICATION_RECIPIENTS set with valid entries → enabled.
 *
 * Environment detection uses getSentryEnvironment() which resolves
 * NEXT_PUBLIC_SENTRY_ENVIRONMENT → NEXT_PUBLIC_VERCEL_ENV → VERCEL_ENV →
 * NODE_ENV.  Unlike bare NODE_ENV this correctly distinguishes the
 * development.readysetllc.com deployment from production — Dockerfile and
 * next start both force NODE_ENV=production regardless of deploy target.
 */
import * as Sentry from "@sentry/nextjs";
import { getSentryEnvironment } from "@/lib/monitoring/sentry-filters";

export const DEFAULT_ORDER_NOTIFICATION_RECIPIENTS = [
  "info@readysetllc.com",
  "austin@readysetllc.com",
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface OrderNotificationConfig {
  readonly recipients: readonly string[];
  readonly enabled: boolean;
}

const DISABLED: OrderNotificationConfig = { recipients: [], enabled: false };

export function getOrderNotificationConfig(): OrderNotificationConfig {
  // 1. Kill switch — nothing below can override it.
  if (process.env.ORDER_NOTIFICATIONS_ENABLED === "false") {
    return DISABLED;
  }

  const rawRecipients = process.env.ORDER_NOTIFICATION_RECIPIENTS;

  // 2. No explicit recipients configured.
  if (!rawRecipients) {
    const env = getSentryEnvironment();
    if (env === "production") {
      return {
        recipients: [...DEFAULT_ORDER_NOTIFICATION_RECIPIENTS],
        enabled: true,
      };
    }
    // Non-production without an explicit list → fail closed.
    return DISABLED;
  }

  // 3–4. Explicit list provided — parse and validate.
  // ADMIN_EMAIL is deliberately NOT in this chain. It is a single-address
  // legacy variable already set to info@readysetllc.com in .env.local and
  // .env.production, so including it would shadow the default list above and
  // austin@ would silently never receive anything.
  const recipients = rawRecipients
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => EMAIL_PATTERN.test(entry));

  if (recipients.length === 0) {
    // Every address was malformed — misconfiguration. Fail closed and scream.
    console.error(
      "[order-notifications] ORDER_NOTIFICATION_RECIPIENTS is set but " +
        "contains no valid addresses — notifications disabled.",
    );
    Sentry.captureMessage(
      "ORDER_NOTIFICATION_RECIPIENTS contains no valid addresses",
      { level: "error" },
    );
    return DISABLED;
  }

  return { recipients, enabled: true };
}
