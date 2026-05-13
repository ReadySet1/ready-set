'use server';

/**
 * Server Action wrapper around `updateCaterValleyOrderStatus`.
 *
 * The underlying service does HMAC-SHA256 signing using
 * `process.env.CATERVALLEY_OUTBOUND_WEBHOOK_SECRET`, which is server-only
 * (Next.js only exposes `NEXT_PUBLIC_*` env vars to the browser bundle).
 * If the service were called from a client component the secret would be
 * `undefined` and the signing branch would silently skip — every browser-
 * triggered sync would ship unsigned, defeating the outbound HMAC
 * rollout from PR #391. Routing through a Server Action keeps the
 * signing on the server where the secret exists.
 *
 * See PR #402 pre-landing review #1.
 */

import {
  updateCaterValleyOrderStatus,
  type OrderStatus as CaterValleyOrderStatus,
  type CaterValleyUpdateResult,
} from '@/services/caterValleyService';

export async function syncCaterValleyOrderStatusAction(
  orderNumber: string,
  status: CaterValleyOrderStatus
): Promise<CaterValleyUpdateResult> {
  return updateCaterValleyOrderStatus(orderNumber, status);
}
