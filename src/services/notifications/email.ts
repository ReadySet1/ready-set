// src/services/notifications/email.ts
// High-level delivery status email notifications built on top of SendGrid.
// This module is server-only and should never be imported into client components.
import "server-only";

import { DriverStatus } from "@/types/user";
import {
  SendGridEmailProvider,
  type EmailProvider,
} from "@/lib/email/sendgrid";
import {
  renderDeliveryTemplate,
  type DeliveryEmailTemplateId,
  type DeliveryTemplateVariables,
} from "@/lib/email/renderTemplate";

export type DeliveryNotificationStatus =
  | "ASSIGNED"
  | "EN_ROUTE_TO_PICKUP"
  | "ARRIVED_AT_PICKUP"
  | "PICKED_UP"
  | "EN_ROUTE_TO_DELIVERY"
  | "ARRIVED_AT_DELIVERY"
  | "DELIVERED";

export interface DeliveryDetails {
  deliveryId: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  driverName?: string;
  estimatedArrival?: string;
  deliveryAddress: string;
  trackingLink: string;
  supportLink: string;
}

export interface EmailPreferences {
  deliveryNotifications: boolean;
}

export class PreferenceError extends Error {}
export class TemplateRenderError extends Error {}
export class EmailProviderError extends Error {}

const mapDriverStatusToNotificationStatus = (
  status: DriverStatus
): DeliveryNotificationStatus | null => {
  switch (status) {
    case DriverStatus.ASSIGNED:
      return "ASSIGNED";
    case DriverStatus.EN_ROUTE_TO_CLIENT:
      return "EN_ROUTE_TO_DELIVERY";
    case DriverStatus.ARRIVED_TO_CLIENT:
      return "ARRIVED_AT_DELIVERY";
    case DriverStatus.COMPLETED:
      return "DELIVERED";
    default:
      return null;
  }
};

const mapNotificationStatusToTemplateId = (
  status: DeliveryNotificationStatus
): DeliveryEmailTemplateId => {
  switch (status) {
    case "ASSIGNED":
      return "delivery-assigned";
    case "EN_ROUTE_TO_PICKUP":
      return "driver-en-route-pickup";
    case "ARRIVED_AT_PICKUP":
      return "driver-arrived-pickup";
    case "PICKED_UP":
      return "order-picked-up";
    case "EN_ROUTE_TO_DELIVERY":
      return "driver-en-route-delivery";
    case "ARRIVED_AT_DELIVERY":
      return "driver-arrived-delivery";
    case "DELIVERED":
      return "delivery-completed";
  }
};

const getSubjectForStatus = (
  status: DeliveryNotificationStatus,
  orderNumber: string
): string => {
  switch (status) {
    case "ASSIGNED":
      return `Your delivery ${orderNumber} has been assigned`;
    case "EN_ROUTE_TO_PICKUP":
      return `Driver is heading to pick up your order ${orderNumber}`;
    case "ARRIVED_AT_PICKUP":
      return `Driver has arrived at pickup for order ${orderNumber}`;
    case "PICKED_UP":
      return `Your order ${orderNumber} has been picked up`;
    case "EN_ROUTE_TO_DELIVERY":
      return `Your order ${orderNumber} is on the way`;
    case "ARRIVED_AT_DELIVERY":
      return `Driver has arrived with your order ${orderNumber}`;
    case "DELIVERED":
      return `Delivery ${orderNumber} is complete`;
  }
};

const provider: EmailProvider = new SendGridEmailProvider();

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 200;

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function sendDeliveryStatusEmail(params: {
  driverStatus: DriverStatus;
  details: DeliveryDetails;
  preferences: EmailPreferences | null;
}): Promise<void> {
  const { driverStatus, details, preferences } = params;

  if (!details.customerEmail) {
    throw new PreferenceError("Missing customer email");
  }

  if (!preferences || !preferences.deliveryNotifications) {
    return;
  }

  const notificationStatus = mapDriverStatusToNotificationStatus(
    driverStatus
  );
  if (!notificationStatus) {
    return;
  }

  const templateId = mapNotificationStatusToTemplateId(notificationStatus);

  const templateVars: DeliveryTemplateVariables = {
    customerName: details.customerName,
    orderNumber: details.orderNumber,
    driverName: details.driverName,
    estimatedArrival: details.estimatedArrival,
    deliveryAddress: details.deliveryAddress,
    trackingLink: details.trackingLink,
    supportLink: details.supportLink,
    currentYear: new Date().getFullYear().toString(),
  };

  let rendered;
  try {
    rendered = renderDeliveryTemplate(templateId, templateVars);
  } catch (error) {
    throw new TemplateRenderError(
      error instanceof Error ? error.message : "Failed to render template"
    );
  }

  const subject = getSubjectForStatus(
    notificationStatus,
    details.orderNumber
  );

  let lastError: string | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await provider.send({
      to: { email: details.customerEmail, name: details.customerName },
      from: {
        email:
          process.env.SENDGRID_SENDER_EMAIL ||
          "noreply@updates.readysetllc.com",
        name: process.env.SENDGRID_SENDER_NAME || "Ready Set",
      },
      content: {
        subject,
        html: rendered.html,
        text: rendered.text,
      },
      category: "delivery_status",
      customArgs: {
        delivery_id: details.deliveryId,
        order_number: details.orderNumber,
        status: notificationStatus,
      },
    });

    if (result.success) {
      return;
    }

    lastError = result.error;
    console.error("Delivery status email send failed", {
      attempt,
      deliveryId: details.deliveryId,
      orderNumber: details.orderNumber,
      status: notificationStatus,
      error: result.error,
    });

    if (attempt < MAX_ATTEMPTS) {
      // Basic exponential backoff
      // eslint-disable-next-line no-await-in-loop
      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  throw new EmailProviderError(lastError || "Unknown email error");
}


