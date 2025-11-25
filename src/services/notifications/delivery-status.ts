import { prisma } from "@/lib/db/prisma";
import { sendDeliveryStatusPush, mapDispatchStatusToPushEvent } from "./push";

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
 * High-level notification entrypoint for dispatch status updates.
 * For now this focuses on customer push notifications and leaves email
 * handling to the existing unified email service where applicable.
 */
export async function sendDispatchStatusNotification(
  params: DispatchStatusNotificationParams
): Promise<{ success: boolean; error?: string }> {
  const { status, dispatchId, orderId, recipientType } = params;

  // Currently only customers receive push notifications.
  if (recipientType !== "CUSTOMER") {
    return { success: true };
  }

  const event = mapDispatchStatusToPushEvent(status);
  if (!event) {
    return { success: true };
  }

  const { profileId, orderNumber } = await resolveOrderContext(orderId);
  if (!profileId) {
    // No associated customer profile – nothing to send.
    return { success: true };
  }

  await sendDeliveryStatusPush({
    profileId,
    event,
    orderId,
    orderNumber: orderNumber ?? undefined,
  });

  return { success: true };
}


