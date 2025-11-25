import { getFirebaseMessaging } from "@/lib/firebase-admin";
import { trackDispatchError, DispatchSystemError } from "@/utils/domain-error-tracking";
import { prisma } from "@/lib/db/prisma";

/**
 * Simple in-memory cache for notification deduplication.
 * Prevents duplicate notifications within a time window (e.g., retries).
 */
const notificationCache = new Map<string, number>();
const NOTIFICATION_DEDUP_TTL_MS = 60_000; // 60 seconds

/**
 * Generate a unique key for deduplication based on profile, event, and order.
 */
function getNotificationCacheKey(profileId: string, event: string, orderId: string): string {
  return `${profileId}:${event}:${orderId}`;
}

/**
 * Check if a notification was recently sent (within TTL window).
 * Returns true if duplicate (should skip), false if new notification.
 */
export function isDuplicateNotification(
  profileId: string,
  event: string,
  orderId: string
): boolean {
  const key = getNotificationCacheKey(profileId, event, orderId);
  const lastSent = notificationCache.get(key);

  if (lastSent && Date.now() - lastSent < NOTIFICATION_DEDUP_TTL_MS) {
    return true;
  }

  return false;
}

/**
 * Mark a notification as sent in the dedup cache.
 */
export function markNotificationSent(
  profileId: string,
  event: string,
  orderId: string
): void {
  const key = getNotificationCacheKey(profileId, event, orderId);
  notificationCache.set(key, Date.now());

  // Cleanup old entries periodically (simple garbage collection)
  if (notificationCache.size > 1000) {
    const now = Date.now();
    for (const [k, timestamp] of notificationCache.entries()) {
      if (now - timestamp > NOTIFICATION_DEDUP_TTL_MS) {
        notificationCache.delete(k);
      }
    }
  }
}

/**
 * Clear the notification cache (useful for testing).
 */
export function clearNotificationCache(): void {
  notificationCache.clear();
}

/**
 * Supported delivery status events for push notifications.
 * These roughly correspond to the events described in REA-124.
 */
export type DeliveryStatusEvent =
  | "delivery:assigned"
  | "driver:en_route"
  | "driver:arrived"
  | "delivery:completed"
  | "delivery:delayed"
  | "delivery:failed";

export interface PushNotificationPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface DeliveryStatusPushParams {
  profileId: string;
  event: DeliveryStatusEvent;
  orderId: string;
  orderNumber?: string;
  trackingUrl?: string;
}

/**
 * Map internal dispatch status to push notification event + message.
 */
export function mapDispatchStatusToPushEvent(status: string): DeliveryStatusEvent | null {
  switch (status) {
    case "ACCEPTED":
      return "delivery:assigned";
    case "EN_ROUTE_TO_DELIVERY":
      return "driver:en_route";
    case "ARRIVED_AT_DELIVERY":
      return "driver:arrived";
    case "DELIVERY_COMPLETE":
      return "delivery:completed";
    case "DELAYED":
      return "delivery:delayed";
    case "FAILED":
      return "delivery:failed";
    default:
      return null;
  }
}

export function buildDeliveryStatusMessage(
  event: DeliveryStatusEvent
): { title: string; body: string } {
  switch (event) {
    case "delivery:assigned":
      return {
        title: "Your delivery has been assigned",
        body: "We’ve assigned a driver to your delivery. We’ll keep you updated as they progress.",
      };
    case "driver:en_route":
      return {
        title: "Your driver is on the way",
        body: "Your delivery is en route. You can track the driver’s progress in real time.",
      };
    case "driver:arrived":
      return {
        title: "Your driver has arrived",
        body: "Your driver has arrived at the delivery location.",
      };
    case "delivery:completed":
      return {
        title: "Delivery completed",
        body: "Your delivery has been completed. Thank you for using Ready Set!",
      };
    case "delivery:delayed":
      return {
        title: "Delivery delayed",
        body: "Your delivery is currently delayed. We’re working to get it back on track.",
      };
    case "delivery:failed":
      return {
        title: "Delivery could not be completed",
        body: "We were unable to complete your delivery. Please check your order status for details.",
      };
    default: {
      const exhaustiveCheck: never = event;
      throw new Error(`Unhandled delivery status event: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Low-level helper to send a single push notification to a specific token.
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<void> {
  const messaging = getFirebaseMessaging();

  if (!messaging) {
    console.warn("Firebase Messaging not available, skipping push notification send.");
    return;
  }

  const message = {
    token: payload.token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data ?? {},
    webpush: {
      fcmOptions: {
        link: payload.data?.url,
      },
    },
  };

  try {
    await messaging.send(message);
  } catch (error) {
    console.error("Push notification error:", error);
    throw error;
  }
}

/**
 * Send a delivery status push notification to all active tokens for a profile.
 * Errors here are tracked but should not break the caller's core flow.
 * Includes rate limiting to prevent duplicate notifications within 60 seconds.
 */
export async function sendDeliveryStatusPush(params: DeliveryStatusPushParams): Promise<void> {
  const { profileId, event, orderId, orderNumber, trackingUrl } = params;

  try {
    // Check for duplicate notification (rate limiting)
    if (isDuplicateNotification(profileId, event, orderId)) {
      console.debug(
        `Skipping duplicate notification: ${event} for profile ${profileId}, order ${orderId}`
      );
      return;
    }

    // Check if user has push notifications enabled
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { hasPushNotifications: true },
    });

    if (!profile || !profile.hasPushNotifications) {
      return;
    }

    // Fetch active tokens for this profile
    const tokens = await prisma.profilePushToken.findMany({
      where: {
        profileId,
        revokedAt: null,
      },
      select: {
        id: true,
        token: true,
      },
    });

    if (!tokens.length) {
      return;
    }

    const { title, body } = buildDeliveryStatusMessage(event);

    const url =
      trackingUrl ??
      `${process.env.NEXT_PUBLIC_SITE_URL || "https://readysetllc.com"}/order-status/${
        orderNumber ?? orderId
      }`;

    const data: Record<string, string> = {
      url,
      orderId,
    };
    if (orderNumber) {
      data.orderNumber = orderNumber;
    }

    // Mark notification as sent before attempting (prevents race conditions on retries)
    markNotificationSent(profileId, event, orderId);

    // Fire-and-forget style: send to all tokens, revoking invalid ones
    await Promise.all(
      tokens.map(async (tokenRecord) => {
        try {
          await sendPushNotification({
            token: tokenRecord.token,
            title,
            body,
            data,
          });
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown push send error";

          const dispatchError = new DispatchSystemError(
            errorMessage,
            "DRIVER_NOTIFICATION_ERROR",
            {
              dispatchId: undefined,
              driverId: undefined,
              orderId,
              notificationDetails: {
                type: "status_update_push",
                recipient: "customer",
              },
            }
          );

          trackDispatchError(dispatchError, dispatchError.type, dispatchError.context);

          // Best-effort invalidation for tokens that are no longer valid.
          if (errorMessage.includes("registration-token-not-registered")) {
            await prisma.profilePushToken.update({
              where: { id: tokenRecord.id },
              data: { revokedAt: new Date() },
            });
          }
        }
      })
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error in sendDeliveryStatusPush";

    const dispatchError = new DispatchSystemError(
      errorMessage,
      "DRIVER_NOTIFICATION_ERROR",
      {
        dispatchId: undefined,
        driverId: undefined,
        orderId,
        notificationDetails: {
          type: "status_update_push",
          recipient: "multiple",
        },
      }
    );

    trackDispatchError(dispatchError, dispatchError.type, dispatchError.context);
  }
}


