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
 *
 * Server actions are plain POST endpoints: nothing upstream authenticates
 * them. Only staff (the roles that can change order status in the admin
 * UI) may trigger a partner sync.
 */

import {
  updateCaterValleyOrderStatus,
  type OrderStatus as CaterValleyOrderStatus,
  type CaterValleyUpdateResult,
} from '@/services/caterValleyService';
import { getActionCaller } from '@/lib/auth/driver-ownership';
import { getUserRole } from '@/lib/auth';

async function callerIsStaff(): Promise<boolean> {
  const caller = await getActionCaller();
  if (!caller) return false;
  if (caller.isPrivileged) return true;
  const role = (await getUserRole(caller.userId))?.toUpperCase();
  return role === 'HELPDESK';
}

export async function syncCaterValleyOrderStatusAction(
  orderNumber: string,
  status: CaterValleyOrderStatus
): Promise<CaterValleyUpdateResult> {
  if (!(await callerIsStaff())) {
    return { success: false, orderFound: false, error: 'Unauthorized', statusCode: 403 };
  }
  return updateCaterValleyOrderStatus(orderNumber, status);
}
