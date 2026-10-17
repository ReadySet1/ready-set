/**
 * Partner outbound webhook dispatcher (registry-driven).
 *
 * The legacy `CarrierWebhookService` only knows about partners hardcoded
 * in `CARRIER_CONFIGS` (CaterValley, ezCater). This service is the
 * general path for any partner in the `api_partners` registry — it reads
 * `webhookUrl` / `webhookSecret` off the resolved partner row at send
 * time and POSTs the contract-shaped status payload, HMAC-SHA256 signed
 * with the `x-readyset-signature` header (see `docs/catercow/API_CONTRACT.md`).
 *
 * Retry model: every event is persisted to `partner_webhook_deliveries`
 * and attempt 1 is made in-request (same latency as before on the happy
 * path). Any non-2xx / timeout / network failure is left to the
 * `/api/admin/partner-webhook-retry` cron worker, which retries with
 * backoff up to the contract's "5 attempts over ~30 minutes" — see
 * `partner-webhook-queue.ts`. A callback that still fails stays
 * recoverable by the partner via GET /orders/{id}.
 */

import { DriverStatus } from '@/types/prisma';
import { prisma } from '@/lib/db/prisma';
import {
  enqueuePartnerWebhook,
  recordAttemptResult,
  sendSignedWebhook,
} from '@/lib/services/partner-webhook-queue';
import { getPartnerByOrderNumber, type ResolvedPartner } from '@/lib/services/partner-registry';
import { CarrierServiceClient } from '@/lib/services/carrier-service-client';
import { webhookLogger } from '@/lib/services/webhook-logger';
import { carrierLogger } from '@/utils/logger';

/** Partner-facing lifecycle states, per the v0.1 API contract. */
export type PartnerLifecycleStatus =
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'ON_THE_WAY'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'CANCELLED';

/**
 * Map our internal driver status to the partner-facing lifecycle event.
 * `null` means "no partner event for this internal transition" — the
 * vendor-leg states are operational detail we don't surface to partners.
 * `CANCELLED` is not here because it isn't a driver-status change; it's
 * emitted directly from the confirm/cancel path.
 */
export const DRIVER_STATUS_TO_PARTNER_LIFECYCLE: Record<DriverStatus, PartnerLifecycleStatus | null> = {
  ASSIGNED: 'ASSIGNED',
  EN_ROUTE_TO_VENDOR: null,
  ARRIVED_AT_VENDOR: null,
  PICKED_UP: 'PICKED_UP',
  EN_ROUTE_TO_CLIENT: 'ON_THE_WAY',
  ARRIVED_TO_CLIENT: 'ARRIVED',
  COMPLETED: 'DELIVERED',
};

export interface PartnerWebhookInput {
  /** Resolved partner row (carries webhookUrl / webhookSecret). */
  partner: ResolvedPartner;
  /** Ready Set order UUID. */
  orderId: string;
  /** Partner's original order code (order number with the prefix stripped). */
  orderCode: string;
  /** Ready Set order number (e.g. `CC-12345`). */
  orderNumber: string;
  status: PartnerLifecycleStatus;
  driver?: { name: string; phone: string };
  location?: { lat: number; lng: number };
  notes?: string;
  /**
   * The `order_status_history` row for this event. It is the queue's
   * idempotency key: an event that is already queued is not sent again.
   */
  statusHistoryId?: string | null;
}

/**
 * `queued` says whether the event made it into the durable queue — when
 * true, a failed first attempt will be retried by the cron worker.
 */
export type PartnerWebhookResult =
  | { delivered: true; attempts: 1; httpStatus: number; queued: boolean }
  | { delivered: false; skipped: 'misconfigured' | 'duplicate'; attempts: 0; httpStatus: null }
  | { delivered: false; attempts: 1; lastError: string; httpStatus: number | null; queued: boolean };

/**
 * Queue a status webhook and make the first attempt. Best-effort: never
 * throws — callers run it after the order state is already committed, so a
 * delivery failure must not roll back or fail the originating request.
 */
export async function dispatchPartnerWebhook(input: PartnerWebhookInput): Promise<PartnerWebhookResult> {
  const { partner } = input;

  if (!partner.webhookUrl || !partner.webhookSecret) {
    carrierLogger.info(
      `[partner-webhook] skipped — partner ${partner.slug} has no webhook ${
        !partner.webhookUrl ? 'URL' : 'secret'
      } configured (order ${input.orderNumber}, status ${input.status})`
    );
    return { delivered: false, skipped: 'misconfigured', attempts: 0, httpStatus: null };
  }

  const payload = {
    orderId: input.orderId,
    orderCode: input.orderCode,
    orderNumber: input.orderNumber,
    status: input.status,
    timestamp: new Date().toISOString(),
    ...(input.driver ? { driver: input.driver } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };
  const body = JSON.stringify(payload);

  const queued = await enqueuePartnerWebhook({
    partnerId: partner.id,
    cateringRequestId: input.orderId,
    orderNumber: input.orderNumber,
    statusHistoryId: input.statusHistoryId ?? null,
    eventStatus: input.status,
    payload,
  });
  if (queued && !queued.created) {
    carrierLogger.info(
      `[partner-webhook] ${input.status} for ${input.orderNumber} is already queued — not sending again`
    );
    return { delivered: false, skipped: 'duplicate', attempts: 0, httpStatus: null };
  }

  const outcome = await sendSignedWebhook({
    url: partner.webhookUrl,
    secret: partner.webhookSecret,
    body,
  });

  if (outcome.ok) {
    await webhookLogger.logSuccess({
      carrierId: partner.slug,
      orderNumber: input.orderNumber,
      status: input.status,
      responseTime: outcome.responseTimeMs,
    });
  } else {
    await webhookLogger.logFailure({
      carrierId: partner.slug,
      orderNumber: input.orderNumber,
      status: input.status,
      errorMessage: outcome.error ?? 'unknown error',
      responseTime: outcome.responseTimeMs,
    });
  }

  if (queued) {
    try {
      await recordAttemptResult(queued, outcome);
    } catch (err) {
      // The row keeps its lease and comes due for the worker, which may
      // repeat a delivered attempt — at-least-once, as the contract allows.
      carrierLogger.error(
        `[partner-webhook] failed to record attempt for ${input.orderNumber}:`,
        err
      );
    }
  }

  return outcome.ok
    ? { delivered: true, attempts: 1, httpStatus: outcome.httpStatus ?? 200, queued: queued !== null }
    : {
        delivered: false,
        attempts: 1,
        lastError: outcome.error ?? 'unknown error',
        httpStatus: outcome.httpStatus,
        queued: queued !== null,
      };
}

function stripPrefix(orderNumber: string, prefix: string): string {
  return prefix && orderNumber.startsWith(prefix) ? orderNumber.slice(prefix.length) : orderNumber;
}

export interface LifecycleEventInput {
  /** Ready Set order UUID (catering_requests.id). */
  orderId: string;
  /** Ready Set order number (e.g. `CC-12345`). */
  orderNumber: string;
  partnerStatus: PartnerLifecycleStatus;
  /** Internal status that triggered the event; null for CANCELLED. */
  driverStatus?: DriverStatus | null;
  /** Profile id of whoever drove the change (driver/admin), if known. */
  changedBy?: string | null;
  driver?: { name: string; phone: string };
  location?: { lat: number; lng: number };
  notes?: string;
}

/**
 * Record a partner lifecycle event to `order_status_history` and dispatch
 * the outbound webhook. Self-contained and best-effort — never throws, so
 * callers can fire it after the order state is already committed:
 *
 *  - Resolves the owning partner from the order number; no-ops if the
 *    order isn't owned by a registry partner.
 *  - Skips partners handled by the legacy `CARRIER_CONFIGS` path
 *    (CaterValley / ezCater) so we never double-send.
 *  - Persists the history row first so GET /orders/{id} reflects the
 *    event even when webhook delivery fails.
 */
export async function recordAndDispatchLifecycleEvent(input: LifecycleEventInput): Promise<void> {
  try {
    // Legacy carriers own their outbound path; don't duplicate here.
    if (CarrierServiceClient.detectCarrier(input.orderNumber)) return;

    const partner = await getPartnerByOrderNumber(input.orderNumber);
    if (!partner) return;

    let statusHistoryId: string | null = null;
    try {
      const history = await prisma.orderStatusHistory.create({
        data: {
          cateringRequestId: input.orderId,
          partnerStatus: input.partnerStatus,
          driverStatus: input.driverStatus ?? null,
          changedBy: input.changedBy ?? null,
          location: input.location ?? undefined,
          notes: input.notes,
        },
        select: { id: true },
      });
      statusHistoryId = history?.id ?? null;
    } catch (err) {
      carrierLogger.error(
        `[partner-webhook] failed to record status history for ${input.orderNumber}:`,
        err
      );
    }

    await dispatchPartnerWebhook({
      partner,
      orderId: input.orderId,
      orderCode: stripPrefix(input.orderNumber, partner.orderPrefix),
      orderNumber: input.orderNumber,
      status: input.partnerStatus,
      driver: input.driver,
      location: input.location,
      notes: input.notes,
      statusHistoryId,
    });
  } catch (err) {
    carrierLogger.error(
      `[partner-webhook] lifecycle dispatch failed for ${input.orderNumber}:`,
      err
    );
  }
}
