/**
 * CaterValley Address Utilities
 * Shared address processing logic for CaterValley API endpoints
 */

import { prisma } from '@/lib/db/prisma';

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
 * Creates or finds an address in the database
 * First attempts to find an existing address, creates new one if not found
 *
 * @param location - Location data containing address details
 * @returns Object with the address ID
 */
export async function ensureAddress(location: LocationData): Promise<{ id: string }> {
  // Parse ZIP from address if not provided separately
  const zipCode = location.zip || extractZipFromAddress(location.address);

  // First, try to find an existing address
  const existingAddress = await prisma.address.findFirst({
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

  // Create new address if not found
  const newAddress = await prisma.address.create({
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

  return newAddress;
}
