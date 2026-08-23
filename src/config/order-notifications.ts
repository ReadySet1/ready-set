/**
 * Recipient configuration for new-order admin notifications.
 * Single source of truth — do not read ADMIN_EMAIL directly elsewhere.
 */
export const DEFAULT_ORDER_NOTIFICATION_RECIPIENTS = [
  "info@readysetllc.com",
  "austin@readysetllc.com",
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface OrderNotificationConfig {
  readonly recipients: readonly string[];
  readonly enabled: boolean;
}

export function getOrderNotificationConfig(): OrderNotificationConfig {
  // Guard: never fan out to the real inboxes from a local dev server or the
  // development.readysetllc.com deployment unless the recipient list was set
  // explicitly for that environment.
  if (
    process.env.NODE_ENV !== "production" &&
    !process.env.ORDER_NOTIFICATION_RECIPIENTS
  ) {
    return { recipients: [], enabled: false };
  }

  // ADMIN_EMAIL is deliberately NOT in this chain. It is a single-address
  // legacy variable already set to info@readysetllc.com in .env.local and
  // .env.production, so including it would shadow the default list above and
  // austin@ would silently never receive anything.
  const raw =
    process.env.ORDER_NOTIFICATION_RECIPIENTS ??
    DEFAULT_ORDER_NOTIFICATION_RECIPIENTS.join(",");

  const recipients = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => EMAIL_PATTERN.test(entry));

  if (recipients.length === 0) {
    console.warn(
      "[order-notifications] No valid recipient configured; " +
        `falling back to ${DEFAULT_ORDER_NOTIFICATION_RECIPIENTS.join(", ")}`,
    );
    return {
      recipients: [...DEFAULT_ORDER_NOTIFICATION_RECIPIENTS],
      enabled: true,
    };
  }

  return {
    recipients,
    enabled: process.env.ORDER_NOTIFICATIONS_ENABLED !== "false",
  };
}
