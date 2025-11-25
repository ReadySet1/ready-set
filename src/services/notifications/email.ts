// src/services/notifications/email.ts
// High-level delivery status email notifications using Resend with resilience.
// This module is server-only and should never be imported into client components.
import "server-only";

import * as Sentry from "@sentry/nextjs";
import { DriverStatus } from "@/types/prisma";
import { sendEmail } from "@/utils/email";
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
  unsubscribeLink: string;
}

export interface EmailPreferences {
  deliveryNotifications: boolean;
}

export class PreferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreferenceError";
  }
}

export class TemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateRenderError";
  }
}

export class EmailProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailProviderError";
  }
}

const mapDriverStatusToNotificationStatus = (
  status: DriverStatus
): DeliveryNotificationStatus | null => {
  switch (status) {
    case "ASSIGNED":
      return "ASSIGNED";
    case "EN_ROUTE_TO_CLIENT":
      return "EN_ROUTE_TO_DELIVERY";
    case "ARRIVED_TO_CLIENT":
      return "ARRIVED_AT_DELIVERY";
    case "COMPLETED":
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

/**
 * Send a delivery status email notification to the customer.
 *
 * Uses Resend with automatic retry, circuit breaker, and timeout handling
 * via the existing email resilience system (REA-77).
 *
 * @param params.driverStatus - The current driver status
 * @param params.details - Delivery details including customer info
 * @param params.preferences - User email preferences (delivery notifications opt-in)
 * @throws {PreferenceError} If customer email is missing
 * @throws {TemplateRenderError} If template rendering fails
 * @throws {EmailProviderError} If email sending fails after retries
 */
export async function sendDeliveryStatusEmail(params: {
  driverStatus: DriverStatus;
  details: DeliveryDetails;
  preferences: EmailPreferences | null;
}): Promise<void> {
  const { driverStatus, details, preferences } = params;

  // Validate customer email
  if (!details.customerEmail) {
    throw new PreferenceError("Missing customer email");
  }

  // Respect user preference for delivery notifications
  if (!preferences || !preferences.deliveryNotifications) {
    return;
  }

  // Map driver status to notification status
  const notificationStatus = mapDriverStatusToNotificationStatus(driverStatus);
  if (!notificationStatus) {
    // Status not mapped to a notification - silently skip
    return;
  }

  const templateId = mapNotificationStatusToTemplateId(notificationStatus);

  // Prepare template variables
  const templateVars: DeliveryTemplateVariables = {
    customerName: details.customerName,
    orderNumber: details.orderNumber,
    driverName: details.driverName,
    estimatedArrival: details.estimatedArrival,
    deliveryAddress: details.deliveryAddress,
    trackingLink: details.trackingLink,
    supportLink: details.supportLink,
    unsubscribeLink: details.unsubscribeLink,
    currentYear: new Date().getFullYear().toString(),
  };

  // Render template
  let rendered;
  try {
    rendered = renderDeliveryTemplate(templateId, templateVars);
  } catch (error) {
    throw new TemplateRenderError(
      error instanceof Error ? error.message : "Failed to render template"
    );
  }

  const subject = getSubjectForStatus(notificationStatus, details.orderNumber);

  // Send email using Resend with resilience (retry + circuit breaker + timeout)
  try {
    await sendEmail({
      to: details.customerEmail,
      subject,
      html: rendered.html,
    });

    Sentry.addBreadcrumb({
      category: "email",
      message: "Delivery status email sent",
      level: "info",
      data: {
        deliveryId: details.deliveryId,
        orderNumber: details.orderNumber,
        status: notificationStatus,
        customerEmail: details.customerEmail.replace(/(.{2}).*@/, "$1***@"),
      },
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        service: "email-notifications",
        status: notificationStatus,
      },
      extra: {
        deliveryId: details.deliveryId,
        orderNumber: details.orderNumber,
      },
    });

    throw new EmailProviderError(
      error instanceof Error ? error.message : "Email sending failed"
    );
  }
}
