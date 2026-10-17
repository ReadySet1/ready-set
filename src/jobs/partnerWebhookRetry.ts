/**
 * Partner webhook retry worker.
 *
 * Resends partner lifecycle webhooks whose in-request first attempt (or an
 * earlier retry) failed, following the backoff in
 * src/lib/services/partner-webhook-queue.ts. Each run:
 *
 * 1. Claims up to `batchSize` due PENDING rows (FOR UPDATE SKIP LOCKED +
 *    lease), so overlapping runs never send the same row twice.
 * 2. Resends each stored payload, signed with the partner's CURRENT secret,
 *    a few at a time.
 * 3. Records the attempt: SUCCEEDED, back to PENDING with the next backoff,
 *    or FAILED after the 5th attempt — reported to Sentry/GlitchTip.
 *
 * A soft-deleted, inactive or unconfigured partner burns an attempt without
 * a request, so a config fixed within the retry window still delivers.
 *
 * Triggered every minute by /api/admin/partner-webhook-retry
 * (see docs/deployment/CRON_JOBS.md).
 */

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/db/prisma';
import {
  MAX_WEBHOOK_ATTEMPTS,
  claimDueDeliveries,
  recordAttemptResult,
  sendSignedWebhook,
  type AttemptOutcome,
} from '@/lib/services/partner-webhook-queue';
import { webhookLogger } from '@/lib/services/webhook-logger';
import { carrierLogger } from '@/utils/logger';

/**
 * Rows per run. With DEFAULT_CONCURRENCY parallel sends and a 10s timeout,
 * a full batch of timeouts takes ~50s — well inside the 5-minute claim lease.
 */
export const DEFAULT_RETRY_BATCH_SIZE = 25;
const DEFAULT_CONCURRENCY = 5;

export interface PartnerWebhookRetryConfig {
  batchSize?: number;
  concurrency?: number;
}

export interface PartnerWebhookRetryResult {
  success: boolean;
  claimed: number;
  succeeded: number;
  retrying: number;
  failed: number;
  /** Rows another worker had already recorded (lease expired mid-run). */
  stale: number;
  /** Rows that threw; their lease expires and they come due again. */
  errors: number;
  durationMs: number;
}

type ClaimedRow = Awaited<ReturnType<typeof loadClaimed>>[number];

function loadClaimed(ids: string[]) {
  return prisma.partnerWebhookDelivery.findMany({
    where: { id: { in: ids }, state: 'PENDING' },
    include: { partner: true },
  });
}

async function attempt(row: ClaimedRow): Promise<AttemptOutcome> {
  const { partner } = row;
  if (partner.deletedAt || !partner.isActive || !partner.webhookUrl || !partner.webhookSecret) {
    return {
      ok: false,
      httpStatus: null,
      error: `partner ${partner.slug} is inactive or has no webhook configured`,
      responseTimeMs: 0,
    };
  }

  const outcome = await sendSignedWebhook({
    url: partner.webhookUrl,
    secret: partner.webhookSecret,
    body: JSON.stringify(row.payload),
  });

  const log = {
    carrierId: partner.slug,
    orderNumber: row.orderNumber,
    status: row.eventStatus,
    responseTime: outcome.responseTimeMs,
  };
  if (outcome.ok) {
    await webhookLogger.logSuccess(log);
  } else {
    await webhookLogger.logFailure({ ...log, errorMessage: outcome.error ?? 'unknown error' });
  }
  return outcome;
}

function reportTerminalFailure(row: ClaimedRow, outcome: AttemptOutcome): void {
  const message = `Partner webhook delivery failed after ${MAX_WEBHOOK_ATTEMPTS} attempts`;
  carrierLogger.error(
    `[partner-webhook] ${message}: ${row.partner.slug} ${row.eventStatus} for ${row.orderNumber} (${outcome.error})`
  );
  Sentry.captureMessage(message, {
    level: 'error',
    tags: { operation: 'partner-webhook-retry', partner: row.partner.slug },
    extra: {
      deliveryId: row.id,
      orderNumber: row.orderNumber,
      eventStatus: row.eventStatus,
      lastError: outcome.error,
      lastStatusCode: outcome.httpStatus,
    },
  });
}

export async function runPartnerWebhookRetry(
  config: PartnerWebhookRetryConfig = {},
): Promise<PartnerWebhookRetryResult> {
  const startedAt = Date.now();
  const batchSize = config.batchSize ?? DEFAULT_RETRY_BATCH_SIZE;
  const concurrency = Math.max(1, config.concurrency ?? DEFAULT_CONCURRENCY);
  const result: PartnerWebhookRetryResult = {
    success: true,
    claimed: 0,
    succeeded: 0,
    retrying: 0,
    failed: 0,
    stale: 0,
    errors: 0,
    durationMs: 0,
  };

  const ids = await claimDueDeliveries(batchSize);
  result.claimed = ids.length;
  if (ids.length > 0) {
    const rows = await loadClaimed(ids);

    for (let i = 0; i < rows.length; i += concurrency) {
      await Promise.all(
        rows.slice(i, i + concurrency).map(async (row) => {
          try {
            const outcome = await attempt(row);
            const recorded = await recordAttemptResult(row, outcome);
            result[recorded] += 1;
            if (recorded === 'failed') reportTerminalFailure(row, outcome);
          } catch (err) {
            result.errors += 1;
            carrierLogger.error(`[partner-webhook] retry of delivery ${row.id} threw:`, err);
            Sentry.captureException(err, {
              tags: { operation: 'partner-webhook-retry' },
              extra: { deliveryId: row.id, orderNumber: row.orderNumber },
            });
          }
        }),
      );
    }
  }

  result.success = result.errors === 0;
  result.durationMs = Date.now() - startedAt;
  return result;
}
