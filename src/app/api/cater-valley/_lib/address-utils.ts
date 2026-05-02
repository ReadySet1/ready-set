/**
 * CaterValley Address Utilities
 * Shared address processing logic for CaterValley API endpoints
 */

import { prisma } from '@/lib/db/prisma';
import type { PrismaExecutor } from './order-utils';

/**
 * Location data structure for address operations
 */
export interface LocationData {
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  phone?: string;
  instructions?: string;
  recipient?: {
    name: string;
    phone: string;
  };
}

/**
 * Extracts ZIP code from an address string
 * Supports both 5-digit (12345) and ZIP+4 (12345-6789) formats
 *
 * @param address - Full address string
 * @returns Extracted ZIP code or empty string if not found
 */
export function extractZipFromAddress(address: string): string {
  const zipMatch = address.match(/\b\d{5}(-\d{4})?\b/);
  return zipMatch ? zipMatch[0] : '';
}

/**
 * Creates or finds an address in the database.
 * Tries to find an existing match first, creates a new row if none exists.
 *
 * @param location - Location data containing address details
 * @param executor - Optional Prisma client/transaction client. Defaults to the
 *   global client. Pass `tx` so the lookup-or-create participates in the
 *   caller's transaction; otherwise an order-create rollback can leave a
 *   newly inserted address orphaned.
 */
export async function ensureAddress(
  location: LocationData,
  executor: PrismaExecutor = prisma
): Promise<{ id: string }> {
  const zipCode = location.zip || extractZipFromAddress(location.address);

  const existingAddress = await executor.address.findFirst({
    where: {
      street1: location.address,
      city: location.city,
      state: location.state,
      zip: zipCode,
    },
    select: { id: true },
  });

  if (existingAddress) {
    return existingAddress;
  }

  return executor.address.create({
    data: {
      street1: location.address,
      city: location.city,
      state: location.state,
      zip: zipCode,
      name: location.name,
      isRestaurant: false, // We'll determine this based on context later
    },
    select: { id: true },
  });
}
