/**
 * Durable outbound partner webhook queue (`partner_webhook_deliveries`).
 *
 * The API contract promises partners "retry with exponential backoff
 * (5 attempts over ~30 minutes)" for non-2xx callbacks. In-request retries
 * can't keep that promise, so every partner lifecycle event is persisted
 * here and retried by the `/api/admin/partner-webhook-retry` cron worker:
 *
 *  - The dispatcher enqueues the event (one row per `order_status_history`
 *    row — the unique `status_history_id` makes enqueueing idempotent) and
 *    makes attempt 1 in-request, so the happy path keeps its latency.
 *  - A failed attempt schedules the next one at 2, 4, 8 and 16 minutes
 *    (attempts at t+0, 2, 6, 14, 30 min). After the 5th failure the row is
 *    marked FAILED and reported; the partner can still resync through
 *    GET /orders/{id}.
 *  - `next_attempt_at` doubles as the claim lease. Claiming pushes it
 *    `CLAIM_LEASE_MS` forward, so concurrent workers skip the row and an
 *    attempt lost to a crash comes due again by itself.
 *
 * Signing is unchanged from the v1 dispatcher: HMAC-SHA256 hex of the exact
 * request body with the partner's current `webhookSecret`, sent in
 * `x-readyset-signature`. Delivery is at-least-once.
 */

import * as Sentry from '@sentry/nextjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { signPayload, SIGNATURE_HEADER } from '@/lib/security/hmac';
import { carrierLogger } from '@/utils/logger';

/** Total attempts per event, the in-request one included. */
export const MAX_WEBHOOK_ATTEMPTS = 5;

/** Wait before attempt n+1, indexed by n-1 (n = attempts already made). */
const RETRY_DELAYS_MS = [2, 4, 8, 16].map((minutes) => minutes * 60_000);

/**
 * How long a claimed row stays invisible to other workers. Must exceed the
 * worst-case time to work through one claimed batch (see the worker's batch
 * size × WEBHOOK_TIMEOUT_MS / concurrency).
 */
export const CLAIM_LEASE_MS = 5 * 60_000;

/** Per-attempt HTTP timeout; the contract asks partners to answer within 10s. */
export const WEBHOOK_TIMEOUT_MS = 10_000;

export type DeliveryAttemptResult = 'succeeded' | 'retrying' | 'failed' | 'stale';

export interface AttemptOutcome {
  ok: boolean;
  httpStatus: number | null;
  error: string | null;
  responseTimeMs: number;
}

/**
 * Delay before the next attempt once `attemptsMade` attempts have failed,
 * or null when the attempt budget is spent.
 */
export function nextAttemptDelayMs(attemptsMade: number): number | null {
  if (attemptsMade >= MAX_WEBHOOK_ATTEMPTS || attemptsMade < 1) return null;
  return RETRY_DELAYS_MS[attemptsMade - 1] ?? null;
}

export interface EnqueueInput {
  partnerId: string;
  cateringRequestId: string;
  orderNumber: string;
  /** The `order_status_history` row this event belongs to (idempotency key). */
  statusHistoryId: string | null;
  eventStatus: string;
  payload: Prisma.InputJsonObject;
}

export interface EnqueuedDelivery {
  id: string;
  attempts: number;
  /** false when the event was already queued (duplicate enqueue). */
  created: boolean;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
}

/**
 * Persist one webhook event. The row starts PENDING with its lease held, so
 * the worker leaves it alone while the caller makes the first attempt.
 * Never throws: on a write failure it returns null and the caller still
 * makes its single in-request attempt (no durability for that event).
 */
export async function enqueuePartnerWebhook(
  input: EnqueueInput,
  now: Date = new Date(),
): Promise<EnqueuedDelivery | null> {
  const select = { id: true, attempts: true } as const;
  try {
    const row = await prisma.partnerWebhookDelivery.create({
      data: {
        partnerId: input.partnerId,
        cateringRequestId: input.cateringRequestId,
        orderNumber: input.orderNumber,
        statusHistoryId: input.statusHistoryId,
        eventStatus: input.eventStatus,
        payload: input.payload,
        state: 'PENDING',
        attempts: 0,
        nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS),
      },
      select,
    });
    return { ...row, created: true };
  } catch (err) {
    if (isUniqueViolation(err) && input.statusHistoryId) {
      try {
        const existing = await prisma.partnerWebhookDelivery.findUnique({
          where: { statusHistoryId: input.statusHistoryId },
          select,
        });
        if (existing) return { ...existing, created: false };
      } catch (lookupErr) {
        err = lookupErr;
      }
    }
    carrierLogger.error(
      `[partner-webhook] failed to enqueue ${input.eventStatus} for ${input.orderNumber}:`,
      err,
    );
    Sentry.captureException(err, {
      tags: { operation: 'partner-webhook-enqueue' },
      extra: { orderNumber: input.orderNumber, eventStatus: input.eventStatus },
    });
    return null;
  }
}

/**
 * Claim up to `limit` due rows for this worker. `FOR UPDATE SKIP LOCKED`
 * keeps concurrent runs from claiming the same row, and moving
 * `next_attempt_at` forward by the lease hides it from later runs until
 * this worker records the attempt (or the lease runs out after a crash).
 */
export async function claimDueDeliveries(limit: number, now: Date = new Date()): Promise<string[]> {
  const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "public"."partner_webhook_deliveries"
    SET "next_attempt_at" = ${leaseUntil}, "updated_at" = ${now}
    WHERE "id" IN (
      SELECT "id" FROM "public"."partner_webhook_deliveries"
      WHERE "state" = 'PENDING' AND "next_attempt_at" <= ${now}
      ORDER BY "next_attempt_at"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"
  `;
  return rows.map((row) => row.id);
}

/**
 * Make one signed POST. Never throws — every failure (non-2xx, timeout,
 * network error) comes back as `ok: false` with a short error string.
 */
export async function sendSignedWebhook(target: {
  url: string;
  secret: string;
  body: string;
}): Promise<AttemptOutcome> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const signature = await signPayload(target.secret, target.body);
    const res = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [SIGNATURE_HEADER]: signature,
      },
      body: target.body,
      signal: controller.signal,
    });
    return {
      ok: res.ok,
      httpStatus: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
      responseTimeMs: Date.now() - start,
    };
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `request timed out after ${WEBHOOK_TIMEOUT_MS}ms`
          : err.message
        : 'unknown error';
    return { ok: false, httpStatus: null, error, responseTimeMs: Date.now() - start };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Record one attempt on a claimed row. `delivery.attempts` is the count
 * BEFORE this attempt; the update is guarded on it (and on PENDING) so a
 * worker whose lease expired can't overwrite a newer result — that case
 * comes back as 'stale'.
 */
export async function recordAttemptResult(
  delivery: { id: string; attempts: number },
  outcome: AttemptOutcome,
  now: Date = new Date(),
): Promise<DeliveryAttemptResult> {
  const attempts = delivery.attempts + 1;
  const common = {
    attempts,
    lastAttemptAt: now,
    lastStatusCode: outcome.httpStatus,
    lastError: outcome.ok ? null : outcome.error,
  };

  let result: Exclude<DeliveryAttemptResult, 'stale'>;
  let data: Prisma.PartnerWebhookDeliveryUpdateManyMutationInput;
  if (outcome.ok) {
    result = 'succeeded';
    data = { ...common, state: 'SUCCEEDED', nextAttemptAt: null, deliveredAt: now };
  } else {
    const delay = nextAttemptDelayMs(attempts);
    if (delay === null) {
      result = 'failed';
      data = { ...common, state: 'FAILED', nextAttemptAt: null };
    } else {
      result = 'retrying';
      data = { ...common, state: 'PENDING', nextAttemptAt: new Date(now.getTime() + delay) };
    }
  }

  const { count } = await prisma.partnerWebhookDelivery.updateMany({
    where: { id: delivery.id, state: 'PENDING', attempts: delivery.attempts },
    data,
  });
  return count === 0 ? 'stale' : result;
}
