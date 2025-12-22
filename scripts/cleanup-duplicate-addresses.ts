/**
 * Cleanup Duplicate Addresses Script
 *
 * This script identifies and merges duplicate addresses in the database.
 * Duplicates are identified by matching normalized (street1, city, state, zip).
 *
 * For each group of duplicates:
 * 1. Keep the oldest entry (canonical)
 * 2. Update all foreign key references to point to the canonical entry
 * 3. Soft-delete the duplicate entries
 *
 * Usage:
 *   npx dotenv -e .env -- npx ts-node scripts/cleanup-duplicate-addresses.ts
 *
 * Add --dry-run flag to preview changes without making them:
 *   npx dotenv -e .env -- npx ts-node scripts/cleanup-duplicate-addresses.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';

// Use direct database URL if available, otherwise modify the pooler URL for statement mode
const getDatabaseUrl = (): string => {
  // Prefer DIRECT_URL for scripts (bypasses connection pooler)
  if (process.env.DIRECT_URL) {
    return process.env.DIRECT_URL;
  }

  // Fall back to DATABASE_URL with pgbouncer mode hint
  const url = process.env.DATABASE_URL || '';
  // Add pgbouncer=true to handle prepared statement conflicts
  if (url && !url.includes('pgbouncer=')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}pgbouncer=true`;
  }
  return url;
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

interface AddressRecord {
  id: string;
  name: string | null;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  createdAt: Date;
  isShared: boolean;
  isRestaurant: boolean;
}

interface DuplicateGroup {
  key: string;
  addresses: AddressRecord[];
  canonical: AddressRecord;
  duplicates: AddressRecord[];
}

/**
 * Normalize an address for comparison purposes
 */
function normalizeForComparison(address: {
  street1: string;
  city: string;
  state: string;
  zip: string;
}): string {
  const normalizeStreet = (street: string): string => {
    return street
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\bst\.?\b/gi, 'street')
      .replace(/\bave\.?\b/gi, 'avenue')
      .replace(/\brd\.?\b/gi, 'road')
      .replace(/\bdr\.?\b/gi, 'drive')
      .replace(/\bblvd\.?\b/gi, 'boulevard')
      .replace(/\bln\.?\b/gi, 'lane')
      .replace(/\bct\.?\b/gi, 'court')
      .replace(/\bste\.?\b/gi, 'suite')
      .replace(/#/g, 'suite');
  };

  return [
    normalizeStreet(address.street1),
    address.city.toLowerCase().trim(),
    address.state.toUpperCase().trim(),
    address.zip.trim().substring(0, 5), // Only compare first 5 digits of zip
  ].join('|');
}

/**
 * Find all duplicate address groups
 */
async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
  // Fetch all non-deleted addresses
  const addresses = await prisma.address.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      street1: true,
      street2: true,
      city: true,
      state: true,
      zip: true,
      createdAt: true,
      isShared: true,
      isRestaurant: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by normalized address
  const groups = new Map<string, AddressRecord[]>();

  for (const address of addresses) {
    const key = normalizeForComparison(address);
    const existing = groups.get(key) || [];
    existing.push(address);
    groups.set(key, existing);
  }

  // Filter to only groups with duplicates (more than 1 address)
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [key, addressList] of groups.entries()) {
    if (addressList.length > 1) {
      // Sort by createdAt to get the oldest first
      addressList.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      // addressList is guaranteed to have at least 2 elements due to the length check
      const canonical = addressList[0]!;
      duplicateGroups.push({
        key,
        addresses: addressList,
        canonical, // Oldest is canonical
        duplicates: addressList.slice(1), // Rest are duplicates
      });
    }
  }

  return duplicateGroups;
}

/**
 * Get counts of references to an address
 */
async function getReferenceCounts(addressId: string): Promise<{
  cateringPickup: number;
  cateringDelivery: number;
  onDemandPickup: number;
  onDemandDelivery: number;
  userAddresses: number;
}> {
  const [
    cateringPickup,
    cateringDelivery,
    onDemandPickup,
    onDemandDelivery,
    userAddresses,
  ] = await Promise.all([
    prisma.cateringRequest.count({ where: { pickupAddressId: addressId } }),
    prisma.cateringRequest.count({ where: { deliveryAddressId: addressId } }),
    prisma.onDemand.count({ where: { pickupAddressId: addressId } }),
    prisma.onDemand.count({ where: { deliveryAddressId: addressId } }),
    prisma.userAddress.count({ where: { addressId } }),
  ]);

  return {
    cateringPickup,
    cateringDelivery,
    onDemandPickup,
    onDemandDelivery,
    userAddresses,
  };
}

/**
 * Merge a duplicate address into the canonical address
 */
async function mergeDuplicate(
  canonical: AddressRecord,
  duplicate: AddressRecord,
  dryRun: boolean
): Promise<{ updated: number; message: string }> {
  const refs = await getReferenceCounts(duplicate.id);
  const totalRefs =
    refs.cateringPickup +
    refs.cateringDelivery +
    refs.onDemandPickup +
    refs.onDemandDelivery +
    refs.userAddresses;

  if (dryRun) {
    return {
      updated: totalRefs,
      message: `[DRY RUN] Would merge "${duplicate.name}" (${duplicate.id}) into "${canonical.name}" (${canonical.id}). References: ${totalRefs}`,
    };
  }

  // Use a transaction to ensure data integrity
  await prisma.$transaction(async (tx) => {
    // Update CateringRequest pickup references
    if (refs.cateringPickup > 0) {
      await tx.cateringRequest.updateMany({
        where: { pickupAddressId: duplicate.id },
        data: { pickupAddressId: canonical.id },
      });
    }

    // Update CateringRequest delivery references
    if (refs.cateringDelivery > 0) {
      await tx.cateringRequest.updateMany({
        where: { deliveryAddressId: duplicate.id },
        data: { deliveryAddressId: canonical.id },
      });
    }

    // Update OnDemand pickup references
    if (refs.onDemandPickup > 0) {
      await tx.onDemand.updateMany({
        where: { pickupAddressId: duplicate.id },
        data: { pickupAddressId: canonical.id },
      });
    }

    // Update OnDemand delivery references
    if (refs.onDemandDelivery > 0) {
      await tx.onDemand.updateMany({
        where: { deliveryAddressId: duplicate.id },
        data: { deliveryAddressId: canonical.id },
      });
    }

    // Delete userAddress relations for the duplicate
    if (refs.userAddresses > 0) {
      await tx.userAddress.deleteMany({
        where: { addressId: duplicate.id },
      });
    }

    // Soft-delete the duplicate address
    await tx.address.update({
      where: { id: duplicate.id },
      data: {
        deletedAt: new Date(),
      },
    });
  });

  return {
    updated: totalRefs,
    message: `Merged "${duplicate.name}" (${duplicate.id}) into "${canonical.name}" (${canonical.id}). Updated ${totalRefs} references.`,
  };
}

/**
 * Main cleanup function
 */
async function cleanupDuplicates(dryRun: boolean): Promise<void> {
  console.log('='.repeat(60));
  console.log('Address Duplicate Cleanup Script');
  console.log(dryRun ? 'MODE: DRY RUN (no changes will be made)' : 'MODE: LIVE');
  console.log('='.repeat(60));
  console.log('');

  // Find duplicate groups
  console.log('Searching for duplicate addresses...\n');
  const duplicateGroups = await findDuplicateGroups();

  if (duplicateGroups.length === 0) {
    console.log('No duplicate addresses found. Database is clean!');
    return;
  }

  console.log(`Found ${duplicateGroups.length} groups of duplicate addresses:\n`);

  let totalDuplicates = 0;
  let totalRefsUpdated = 0;

  for (const group of duplicateGroups) {
    console.log('-'.repeat(60));
    console.log(`Address: ${group.key}`);
    console.log(`Canonical (keeping): "${group.canonical.name}" (${group.canonical.id})`);
    console.log(`  Created: ${group.canonical.createdAt.toISOString()}`);
    console.log(`Duplicates to merge: ${group.duplicates.length}`);
    console.log('');

    for (const duplicate of group.duplicates) {
      const result = await mergeDuplicate(group.canonical, duplicate, dryRun);
      console.log(`  ${result.message}`);
      totalRefsUpdated += result.updated;
      totalDuplicates++;
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Duplicate groups found: ${duplicateGroups.length}`);
  console.log(`Total duplicates ${dryRun ? 'to merge' : 'merged'}: ${totalDuplicates}`);
  console.log(`Total references ${dryRun ? 'to update' : 'updated'}: ${totalRefsUpdated}`);

  if (dryRun) {
    console.log('\nThis was a DRY RUN. Run without --dry-run to apply changes.');
  } else {
    console.log('\nCleanup completed successfully!');
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    await cleanupDuplicates(dryRun);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
