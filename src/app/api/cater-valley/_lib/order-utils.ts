/**
 * CaterValley Order Utilities
 * Shared order processing logic for CaterValley API endpoints
 */

import { prisma } from '@/lib/db/prisma';

/**
 * Normalizes order number with CV- prefix
 * Ensures order codes always have a single CV- prefix, avoiding duplicate prefixes
 *
 * @param orderCode - The order code from CaterValley (may or may not include CV- prefix)
 * @returns Order number with single CV- prefix
 */
export function normalizeOrderNumber(orderCode: string): string {
  // If orderCode already starts with CV-, use it as-is
  // Otherwise, add the CV- prefix
  return orderCode.startsWith('CV-') ? orderCode : `CV-${orderCode}`;
}

/**
 * Creates or finds the CaterValley system user
 * Used as the owner for all CaterValley orders
 *
 * @returns The CaterValley system user profile
 */
export async function ensureCaterValleySystemUser() {
  return await prisma.profile.upsert({
    where: { email: 'system@catervalley.com' },
    update: {
      updatedAt: new Date(),
      status: 'ACTIVE',
    },
    create: {
      email: 'system@catervalley.com',
      name: 'CaterValley System',
      type: 'CLIENT',
      companyName: 'CaterValley',
      status: 'ACTIVE',
    },
  });
}

/**
 * Checks if an order status allows modifications
 *
 * @param status - Current order status
 * @returns true if the order can be modified
 */
export function isOrderEditable(status: string): boolean {
  const editableStatuses = ['PENDING', 'ACTIVE'];
  return editableStatuses.includes(status);
}

/**
 * Verifies an order belongs to CaterValley
 *
 * @param orderNumber - The order number
 * @param userEmail - The user email associated with the order
 * @returns true if this is a CaterValley order
 */
export function isCaterValleyOrder(orderNumber: string, userEmail: string): boolean {
  return orderNumber.startsWith('CV-') && userEmail === 'system@catervalley.com';
}
