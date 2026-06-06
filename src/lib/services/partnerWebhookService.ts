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
 * Retry model (v1): up to 3 synchronous attempts with exponential
 * backoff, no retry on 4xx. The contract's "5 attempts over ~30 min"
 * durability needs a queue/cron and is a planned fast-follow; until then
 * a missed callback is recoverable by the partner via GET /orders/{id}.
 */

import { DriverStatus } from '@/types/prisma';
import { prisma } from '@/lib/db/prisma';
import { signPayload, SIGNATURE_HEADER } from '@/lib/security/hmac';
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
}

export type PartnerWebhookResult =
  | { delivered: true; attempts: number; httpStatus: number }
  | { delivered: false; skipped: 'misconfigured'; attempts: 0; httpStatus: null }
  | { delivered: false; attempts: number; lastError: string; httpStatus: number | null };

const RETRY = { maxAttempts: 3, baseDelayMs: 1000, timeoutMs: 10_000 };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a single status webhook to a partner. Best-effort: never throws —
 * callers fire-and-forget after the order state is already committed, so
 * a delivery failure must not roll back or fail the originating request.
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
  const signature = await signPayload(partner.webhookSecret, body);

  let lastError = 'unknown error';
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= RETRY.maxAttempts; attempt++) {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RETRY.timeoutMs);

    try {
      const res = await fetch(partner.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [SIGNATURE_HEADER]: signature,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      lastStatus = res.status;
      const responseTime = Date.now() - start;

      if (res.ok) {
        await webhookLogger.logSuccess({
          carrierId: partner.slug,
          orderNumber: input.orderNumber,
          status: input.status,
          responseTime,
        });
        return { delivered: true, attempts: attempt, httpStatus: res.status };
      }

      lastError = `HTTP ${res.status}`;
      await webhookLogger.logFailure({
        carrierId: partner.slug,
        orderNumber: input.orderNumber,
        status: input.status,
        errorMessage: lastError,
        responseTime,
      });

      // 4xx is a client error on the partner's side — retrying won't help.
      if (res.status >= 400 && res.status < 500) break;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError =
        err instanceof Error
          ? err.name === 'AbortError'
            ? `request timed out after ${RETRY.timeoutMs}ms`
            : err.message
          : 'unknown error';
      await webhookLogger.logFailure({
        carrierId: partner.slug,
        orderNumber: input.orderNumber,
        status: input.status,
        errorMessage: lastError,
        responseTime: Date.now() - start,
      });
    }

    if (attempt < RETRY.maxAttempts) {
      await sleep(RETRY.baseDelayMs * Math.pow(2, attempt - 1));
    }
  }

  return { delivered: false, attempts: RETRY.maxAttempts, lastError, httpStatus: lastStatus };
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

    try {
      await prisma.orderStatusHistory.create({
        data: {
          cateringRequestId: input.orderId,
          partnerStatus: input.partnerStatus,
          driverStatus: input.driverStatus ?? null,
          changedBy: input.changedBy ?? null,
          location: input.location ?? undefined,
          notes: input.notes,
        },
      });
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
    });
  } catch (err) {
    carrierLogger.error(
      `[partner-webhook] lifecycle dispatch failed for ${input.orderNumber}:`,
      err
    );
  }
}
