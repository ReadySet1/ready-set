/**
 * Dispatcher for admin email notifications on order creation.
 *
 * Single choke point: every creation path drops an order id here,
 * and this module handles the fetch, mapping, send, and error reporting.
 * Called AFTER the transaction commits — never inside prisma.$transaction.
 */
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  sendOrderNotificationToAdmin,
  type OrderNotificationData,
  type AddressData,
} from "@/services/email-notification";
import { getOrderNotificationConfig } from "@/config/order-notifications";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NewOrderType = "catering" | "on_demand";

/** Where the order came from — surfaced in the email body. */
export type OrderCreationSource =
  | "customer_portal"
  | "admin_dashboard"
  | "orders_api"
  | "partner_api";

export interface NotifyOrderCreatedInput {
  readonly orderId: string;
  readonly orderType: NewOrderType;
  readonly source: OrderCreationSource;
}

export interface NotifyOrderCreatedResult {
  readonly sent: boolean;
  readonly reason?: "disabled" | "order_not_found" | "send_failed";
}

// ---------------------------------------------------------------------------
// Prisma payload types (with included relations)
// ---------------------------------------------------------------------------

type CateringWithRelations = Prisma.CateringRequestGetPayload<{
  include: { user: true; pickupAddress: true; deliveryAddress: true };
}>;

type OnDemandWithRelations = Prisma.OnDemandGetPayload<{
  include: { user: true; pickupAddress: true; deliveryAddress: true };
}>;

// ---------------------------------------------------------------------------
// Mapper — pure function, unit-testable without a DB
// ---------------------------------------------------------------------------

function mapAddress(addr: {
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  county: string | null;
}): AddressData {
  return {
    street1: addr.street1,
    street2: addr.street2,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    county: addr.county,
  };
}

export function buildOrderNotificationData(
  order: CateringWithRelations | OnDemandWithRelations,
  orderType: NewOrderType,
  source: OrderCreationSource,
): OrderNotificationData {
  const base: OrderNotificationData = {
    orderNumber: order.orderNumber,
    orderType,
    customerName: order.user?.name ?? "Unknown",
    customerEmail: order.user?.email ?? "unknown@example.com",
    date: order.pickupDateTime ?? null,
    pickupTime: order.pickupDateTime ?? null,
    arrivalTime: order.arrivalDateTime ?? null,
    completeTime: order.completeDateTime ?? null,
    orderTotal: order.orderTotal?.toString() ?? "0",
    clientAttention: order.clientAttention ?? null,
    status: order.status ?? null,
    driverStatus: order.driverStatus ?? null,
    pickupAddress: mapAddress(order.pickupAddress),
    deliveryAddress: mapAddress(order.deliveryAddress),
    pickupNotes: order.pickupNotes ?? null,
    specialNotes: order.specialNotes ?? null,
    source,
  };

  if (orderType === "catering") {
    const catering = order as CateringWithRelations;
    return {
      ...base,
      brokerage: catering.brokerage ?? null,
      headcount: catering.headcount?.toString() ?? null,
      needHost: catering.needHost ?? null,
      hoursNeeded: catering.hoursNeeded?.toString() ?? null,
      numberOfHosts: catering.numberOfHosts?.toString() ?? null,
    };
  }

  const onDemand = order as OnDemandWithRelations;
  return {
    ...base,
    itemDelivered: onDemand.itemDelivered ?? null,
    vehicleType: onDemand.vehicleType ?? null,
    dimensions: {
      length: onDemand.length?.toString() ?? null,
      width: onDemand.width?.toString() ?? null,
      height: onDemand.height?.toString() ?? null,
    },
    weight: onDemand.weight?.toString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Sentry context helper — DRY up the repeated tags/extra blocks.
// orderId goes in `extra`, never `tags` — tags are indexed and a unique
// value per event blows up Sentry's tag cardinality limits.
// ---------------------------------------------------------------------------

function sentryContext(input: NotifyOrderCreatedInput) {
  return {
    tags: {
      operation: "notifyOrderCreated" as const,
      orderType: input.orderType,
      source: input.source,
    },
    extra: { orderId: input.orderId },
  };
}

// ---------------------------------------------------------------------------
// Dispatcher — the awaitable form (use when you need the result)
// ---------------------------------------------------------------------------

export async function notifyOrderCreated(
  input: NotifyOrderCreatedInput,
): Promise<NotifyOrderCreatedResult> {
  const config = getOrderNotificationConfig();
  if (!config.enabled) return { sent: false, reason: "disabled" };

  try {
    const order =
      input.orderType === "catering"
        ? await prisma.cateringRequest.findUnique({
            where: { id: input.orderId },
            include: { user: true, pickupAddress: true, deliveryAddress: true },
          })
        : await prisma.onDemand.findUnique({
            where: { id: input.orderId },
            include: { user: true, pickupAddress: true, deliveryAddress: true },
          });

    if (!order) {
      console.error(
        `[notifyOrderCreated] Order not found: ${input.orderType}/${input.orderId}`,
      );
      Sentry.captureMessage("Order notification: order not found", {
        level: "warning",
        ...sentryContext(input),
      });
      return { sent: false, reason: "order_not_found" };
    }

    const sent = await sendOrderNotificationToAdmin(
      buildOrderNotificationData(order, input.orderType, input.source),
    );

    if (!sent) {
      // sendOrderNotificationToAdmin swallows its own errors and returns
      // false — the MOST LIKELY failure mode (Resend down, bad key, rate
      // limit) never reaches the catch block below. Report here or Sentry
      // stays blind to it.
      console.error(
        `[notifyOrderCreated] Send failed for ${input.orderType}/${input.orderId}`,
      );
      Sentry.captureMessage("Order notification send failed", {
        level: "warning",
        ...sentryContext(input),
      });
      return { sent: false, reason: "send_failed" };
    }

    return { sent: true };
  } catch (error) {
    console.error("[notifyOrderCreated] Unexpected failure:", error);
    Sentry.captureException(error, sentryContext(input));
    return { sent: false, reason: "send_failed" };
  }
}

