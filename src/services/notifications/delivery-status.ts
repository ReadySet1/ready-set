import { prisma } from "@/lib/db/prisma";
import {
  sendDeliveryStatusPush,
  mapDispatchStatusToPushEvent,
  DeliveryStatusEvent,
} from "./push";

/**
 * Recipient types supported by the dispatch status system.
 */
export type DispatchNotificationRecipient = "CUSTOMER" | "ADMIN" | "STORE";

export interface DispatchStatusNotificationParams {
  status: string;
  dispatchId: string;
  orderId: string;
  recipientType: DispatchNotificationRecipient;
}

/**
 * Message templates for different recipient types.
 */
const CUSTOMER_MESSAGES: Record<DeliveryStatusEvent, { title: string; body: string }> = {
  "delivery:assigned": {
    title: "Your delivery has been assigned",
    body: "We've assigned a driver to your delivery. We'll keep you updated as they progress.",
  },
  "driver:en_route": {
    title: "Your driver is on the way",
    body: "Your delivery is en route. You can track the driver's progress in real time.",
  },
  "driver:arrived": {
    title: "Your driver has arrived",
    body: "Your driver has arrived at the delivery location.",
  },
  "delivery:completed": {
    title: "Delivery completed",
    body: "Your delivery has been completed. Thank you for using Ready Set!",
  },
  "delivery:delayed": {
    title: "Delivery delayed",
    body: "Your delivery is currently delayed. We're working to get it back on track.",
  },
  "delivery:failed": {
    title: "Delivery could not be completed",
    body: "We were unable to complete your delivery. Please check your order status for details.",
  },
};

const ADMIN_MESSAGES: Record<DeliveryStatusEvent, { title: string; body: string }> = {
  "delivery:assigned": {
    title: "Order Assigned",
    body: "A driver has been assigned to order",
  },
  "driver:en_route": {
    title: "Driver En Route",
    body: "Driver is en route for order",
  },
  "driver:arrived": {
    title: "Driver Arrived",
    body: "Driver has arrived for order",
  },
  "delivery:completed": {
    title: "Delivery Complete",
    body: "Order delivered successfully",
  },
  "delivery:delayed": {
    title: "Delivery Delayed",
    body: "Order is experiencing delays",
  },
  "delivery:failed": {
    title: "Delivery Failed - Action Required",
    body: "Order delivery failed",
  },
};

const VENDOR_MESSAGES: Partial<Record<DeliveryStatusEvent, { title: string; body: string }>> = {
  "delivery:assigned": {
    title: "Your Order Picked Up",
    body: "A driver has been assigned to pick up your order",
  },
  "delivery:completed": {
    title: "Order Delivered",
    body: "Your order was delivered successfully",
  },
  "delivery:failed": {
    title: "Delivery Issue",
    body: "There was an issue with your order delivery",
  },
};

/**
 * Resolve the customer profile and order information needed for notifications.
 * This uses the catering/on-demand order tables that back the client dashboard.
 */
async function resolveOrderContext(orderId: string): Promise<{
  profileId: string | null;
  orderNumber: string | null;
}> {
  // Try catering first
  const cateringOrder = await prisma.cateringRequest.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
    },
  });

  if (cateringOrder) {
    return {
      profileId: cateringOrder.userId,
      orderNumber: cateringOrder.orderNumber,
    };
  }

  const onDemandOrder = await prisma.onDemand.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
    },
  });

  if (onDemandOrder) {
    return {
      profileId: onDemandOrder.userId,
      orderNumber: onDemandOrder.orderNumber,
    };
  }

  return {
    profileId: null,
    orderNumber: null,
  };
}

/**
 * Resolve admin profiles that should receive push notifications.
 * Returns profiles with push notifications enabled.
 */
async function resolveAdminProfiles(): Promise<string[]> {
  const admins = await prisma.profile.findMany({
    where: {
      type: { in: ["ADMIN", "SUPER_ADMIN", "HELPDESK"] },
      hasPushNotifications: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/**
 * Resolve the vendor/store profile for an order.
 * Returns the user who created the order (vendor).
 */
async function resolveStoreProfile(orderId: string): Promise<string | null> {
  // Try CateringRequest first - the user is the vendor
  const catering = await prisma.cateringRequest.findUnique({
    where: { id: orderId },
    select: {
      user: {
        select: {
          id: true,
          hasPushNotifications: true,
          type: true,
        },
      },
    },
  });

  if (catering?.user?.type === "VENDOR" && catering.user.hasPushNotifications) {
    return catering.user.id;
  }

  // Fall back to OnDemand
  const onDemand = await prisma.onDemand.findUnique({
    where: { id: orderId },
    select: {
      user: {
        select: {
          id: true,
          hasPushNotifications: true,
          type: true,
        },
      },
    },
  });

  if (onDemand?.user?.type === "VENDOR" && onDemand.user.hasPushNotifications) {
    return onDemand.user.id;
  }

  return null;
}

/**
 * Get the message template for a given recipient type and event.
 */
function getMessageTemplate(
  recipientType: DispatchNotificationRecipient,
  event: DeliveryStatusEvent,
  orderNumber?: string
): { title: string; body: string } | null {
  let messages: Record<DeliveryStatusEvent, { title: string; body: string }> | Partial<Record<DeliveryStatusEvent, { title: string; body: string }>>;

  switch (recipientType) {
    case "CUSTOMER":
      messages = CUSTOMER_MESSAGES;
      break;
    case "ADMIN":
      messages = ADMIN_MESSAGES;
      break;
    case "STORE":
      messages = VENDOR_MESSAGES;
      break;
    default:
      return null;
  }

  const template = messages[event];
  if (!template) return null;

  // Append order number to body if available
  const body = orderNumber ? `${template.body} #${orderNumber}` : template.body;

  return {
    title: template.title,
    body,
  };
}

/**
 * High-level notification entrypoint for dispatch status updates.
 * Supports CUSTOMER, ADMIN, and STORE recipient types.
 */
export async function sendDispatchStatusNotification(
  params: DispatchStatusNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const { status, dispatchId, orderId, recipientType } = params;

  const event = mapDispatchStatusToPushEvent(status);
  if (!event) {
    return { success: true };
  }

  // Resolve order context for order number
  const { orderNumber } = await resolveOrderContext(orderId);

  // Get message template for this recipient type and event
  const messageTemplate = getMessageTemplate(recipientType, event, orderNumber ?? undefined);
  if (!messageTemplate) {
    // This event type doesn't have a message for this recipient type
    return { success: true };
  }

  // Resolve recipient profiles based on type
  let profileIds: string[] = [];

  switch (recipientType) {
    case "CUSTOMER": {
      const { profileId } = await resolveOrderContext(orderId);
      if (profileId) {
        profileIds = [profileId];
      }
      break;
    }
    case "ADMIN": {
      // Only notify admins for critical events
      const criticalEvents: DeliveryStatusEvent[] = [
        "delivery:completed",
        "delivery:failed",
        "delivery:delayed",
      ];
      if (criticalEvents.includes(event)) {
        profileIds = await resolveAdminProfiles();
      }
      break;
    }
    case "STORE": {
      const storeId = await resolveStoreProfile(orderId);
      if (storeId) {
        profileIds = [storeId];
      }
      break;
    }
  }

  if (profileIds.length === 0) {
    // No recipients found
    return { success: true };
  }

  // Send to all resolved profiles
  const results = await Promise.allSettled(
    profileIds.map((id) =>
      sendDeliveryStatusPush({
        profileId: id,
        event,
        orderId,
        orderNumber: orderNumber ?? undefined,
      })
    )
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.error(
      `Failed to send ${failures.length}/${results.length} notifications for ${recipientType}`
    );
  }

  return { success: true };
}
