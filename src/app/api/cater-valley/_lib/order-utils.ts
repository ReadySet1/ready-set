/**
 * Partner Order API order utilities.
 *
 * These helpers are partner-aware: order number prefixes, system user
 * email, brokerage label, and ownership checks all derive from the
 * `ResolvedPartner` row at the route boundary. The legacy
 * `normalizeOrderNumber` / `ensureCaterValleySystemUser` /
 * `isCaterValleyOrder` exports remain as thin pinned-to-CaterValley
 * wrappers so existing tests keep passing.
 */

import { prisma } from '@/lib/db/prisma';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ResolvedPartner } from '@/lib/services/partner-registry';

/**
 * Either the global Prisma client or a transaction client. Helpers accept
 * this so callers can opt-in to transactional execution by passing the
 * `tx` argument from `prisma.$transaction(async (tx) => ...)`.
 */
export type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

/**
 * Build an order number from the partner's prefix + the order code.
 * Idempotent: if the orderCode already starts with the prefix it's
 * returned unchanged, so retries from partners that pre-prefix don't
 * end up with `CC-CC-12345`.
 */
export function buildOrderNumber(orderCode: string, prefix: string): string {
  return orderCode.startsWith(prefix) ? orderCode : `${prefix}${orderCode}`;
}

/**
 * Email address used for the partner's system user (the Profile that
 * owns API-submitted orders). Pattern: `system@<slug>.com`. Stable
 * across runs so existing CaterValley orders keep their owner.
 */
export function partnerSystemUserEmail(partner: ResolvedPartner): string {
  return `system@${partner.slug}.com`;
}

/**
 * Upsert the partner's system user. Used as the owner of all orders
 * submitted via the partner API. Pass `tx` to participate in a
 * surrounding transaction.
 */
export async function ensurePartnerSystemUser(
  partner: ResolvedPartner,
  executor: PrismaExecutor = prisma
) {
  const email = partnerSystemUserEmail(partner);
  return executor.profile.upsert({
    where: { email },
    update: {
      updatedAt: new Date(),
      status: 'ACTIVE',
    },
    create: {
      email,
      name: `${partner.displayName} System`,
      type: 'CLIENT',
      companyName: partner.displayName,
      status: 'ACTIVE',
    },
  });
}

/**
 * Verify an order belongs to the named partner — both the order number
 * prefix and the owning user's email must match. Prevents one partner
 * from updating/confirming another partner's orders even with valid
 * credentials.
 */
export function isPartnerOrder(
  orderNumber: string,
  userEmail: string,
  partner: ResolvedPartner
): boolean {
  return (
    orderNumber.startsWith(partner.orderPrefix) &&
    userEmail === partnerSystemUserEmail(partner)
  );
}

/**
 * Build the `guid` value written to `catering_requests`. The guid
 * encodes the partner slug + order code + a wall-clock timestamp so
 * two partners submitting the same orderCode produce distinguishable
 * guids.
 */
export function buildOrderGuid(orderCode: string, partner: ResolvedPartner): string {
  return `${partner.slug}-${orderCode}-${Date.now()}`;
}

/**
 * Checks if an order status allows modifications.
 */
export function isOrderEditable(status: string): boolean {
  const editableStatuses = ['PENDING', 'ACTIVE'];
  return editableStatuses.includes(status);
}

// ---------------------------------------------------------------------
// Backward-compat wrappers — pinned to CaterValley.
// Kept so legacy tests and call sites that haven't moved to the
// partner-aware helpers above continue to work unchanged.
// ---------------------------------------------------------------------

const CATER_VALLEY_PREFIX = 'CV-';
const CATER_VALLEY_SYSTEM_EMAIL = 'system@catervalley.com';

/**
 * Normalizes order number with CV- prefix.
 * @deprecated Use `buildOrderNumber(orderCode, partner.orderPrefix)`.
 */
export function normalizeOrderNumber(orderCode: string): string {
  return buildOrderNumber(orderCode, CATER_VALLEY_PREFIX);
}

/**
 * Creates or finds the CaterValley system user.
 * @deprecated Use `ensurePartnerSystemUser(partner, executor)`.
 */
export async function ensureCaterValleySystemUser(executor: PrismaExecutor = prisma) {
  return executor.profile.upsert({
    where: { email: CATER_VALLEY_SYSTEM_EMAIL },
    update: {
      updatedAt: new Date(),
      status: 'ACTIVE',
    },
    create: {
      email: CATER_VALLEY_SYSTEM_EMAIL,
      name: 'CaterValley System',
      type: 'CLIENT',
      companyName: 'CaterValley',
      status: 'ACTIVE',
    },
  });
}

/**
 * Verifies an order belongs to CaterValley.
 * @deprecated Use `isPartnerOrder(orderNumber, userEmail, partner)`.
 */
export function isCaterValleyOrder(orderNumber: string, userEmail: string): boolean {
  return orderNumber.startsWith(CATER_VALLEY_PREFIX) && userEmail === CATER_VALLEY_SYSTEM_EMAIL;
}
