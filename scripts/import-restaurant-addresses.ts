#!/usr/bin/env tsx

/**
 * Import Restaurant Addresses Script
 *
 * This script imports restaurant addresses from the restaurant_addresses.ts file
 * and inserts them into the database with proper parsing and organization.
 *
 * Run with: pnpm tsx scripts/import-restaurant-addresses.ts
 */

import { PrismaClient } from '@prisma/client';
import { restaurantAddresses } from './restaurant_addresses';

const prisma = new PrismaClient();

interface ParsedAddress {
  name: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  county: string | null;
}

/**
 * State name to abbreviation mapping
 */
const stateAbbreviations: Record<string, string> = {
  'texas': 'TX',
  'california': 'CA',
  'ca': 'CA',
  'tx': 'TX',
};

/**
 * Parse a raw address string into structured components
 * Handles various address formats like:
 * - "123 Main St, San Jose, CA 95110"
 * - "123 Main St #100, San Jose, CA, 95110"
 * - "123 Main St, Building: 123, Austin, TX 78704"
 * - "123 Main St, Austin, Texas 78704" (full state names)
 * - "123 Main St San Mateo, CA 94401" (missing comma)
 */
function parseAddress(rawAddress: string): Omit<ParsedAddress, 'name'> {
  // Clean up the address
  let address = rawAddress.trim();

  // Remove trailing special characters
  address = address.replace(/·$/, '').trim();

  // Try to match state (abbreviation or full name) and zip
  // Handles: "CA 95110", "CA, 95110", "Texas 78704", "California 95110"
  const stateZipMatch = address.match(/,?\s*([A-Za-z]+)\s*,?\s*(\d{4,5}(?:-\d{4})?)\s*$/i);

  if (!stateZipMatch || !stateZipMatch[1] || !stateZipMatch[2] || stateZipMatch.index === undefined) {
    console.warn(`⚠️  Could not parse state/zip from: ${rawAddress}`);
    throw new Error(`Failed to parse address: ${rawAddress}`);
  }

  const rawState = stateZipMatch[1].toLowerCase();
  const state = stateAbbreviations[rawState] || stateZipMatch[1].toUpperCase();
  const zip = stateZipMatch[2];

  // If zip is 4 digits, it's likely incomplete - skip this address
  if (zip.length === 4) {
    throw new Error(`Incomplete zip code: ${zip} in address: ${rawAddress}`);
  }

  // Remove state and zip from the address
  const addressWithoutStateZip = address.substring(0, stateZipMatch.index).trim();

  // Split remaining address by commas (but handle missing commas)
  let parts = addressWithoutStateZip.split(',').map(p => p.trim()).filter(p => p);

  // Handle cases where there's no comma before city (e.g., "123 Main St San Mateo")
  if (parts.length === 1 && parts[0]) {
    // Try to split by common city patterns - assume last 1-3 words are city
    const words = parts[0].split(/\s+/);
    if (words.length >= 3) {
      // Assume last 2 words might be city (e.g., "San Jose", "Mountain View")
      const street1 = words.slice(0, -2).join(' ');
      const city = words.slice(-2).join(' ');
      parts = [street1, city];
    }
  }

  if (parts.length < 2) {
    console.warn(`⚠️  Not enough address parts in: ${rawAddress}`);
    throw new Error(`Failed to parse address: ${rawAddress}`);
  }

  // Last part before state is the city
  const city = parts[parts.length - 1];

  // Everything else is street address (street1 + optional street2)
  const streetParts = parts.slice(0, -1);

  // If we have "Building: XXX" or similar patterns, treat as street2
  let street1 = streetParts[0];
  let street2: string | null = null;

  if (streetParts.length > 1) {
    // Check if subsequent parts look like building/unit info
    const buildingInfo = streetParts.slice(1).join(', ');
    if (buildingInfo.toLowerCase().includes('building:') ||
        buildingInfo.toLowerCase().includes('suite') ||
        buildingInfo.toLowerCase().includes('unit') ||
        buildingInfo.startsWith('#')) {
      street2 = buildingInfo;
    } else {
      // Otherwise, combine all as street1
      street1 = streetParts.join(', ');
    }
  }

  return {
    street1: street1 || '',
    street2: street2 || null,
    city: city || '',
    state: state || '',
    zip: zip || '',
    county: null, // We don't have county information in the raw data
  };
}

/**
 * Clean restaurant name (remove underscores and convert to title case)
 */
function cleanRestaurantName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Main import function
 */
async function importRestaurantAddresses() {
  console.log('🍽️  Starting restaurant address import...\n');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  const errors: Array<{ restaurant: string; error: string }> = [];

  try {
    // Process each restaurant
    for (const restaurant of restaurantAddresses) {
      try {
        // Parse the address
        const parsedAddress = parseAddress(restaurant.address);
        const cleanName = cleanRestaurantName(restaurant.name);

        // Check if this address already exists (by name and street1)
        const existingAddress = await prisma.address.findFirst({
          where: {
            name: cleanName,
            street1: parsedAddress.street1,
            isRestaurant: true,
          },
        });

        if (existingAddress) {
          console.log(`⏭️  Skipping ${cleanName} - Already exists`);
          skipCount++;
          continue;
        }

        // Create the address in the database
        const newAddress = await prisma.address.create({
          data: {
            name: cleanName,
            street1: parsedAddress.street1,
            street2: parsedAddress.street2,
            city: parsedAddress.city,
            state: parsedAddress.state,
            zip: parsedAddress.zip,
            county: parsedAddress.county,
            isRestaurant: true,
            isShared: true, // Make restaurants shared so all users can see them
            createdBy: null, // System-created addresses don't have a creator
          },
        });

        console.log(`✅ Imported: ${cleanName}`);
        console.log(`   ${parsedAddress.street1}, ${parsedAddress.city}, ${parsedAddress.state} ${parsedAddress.zip}`);
        successCount++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Error importing ${restaurant.name}: ${errorMessage}`);
        errors.push({
          restaurant: restaurant.name,
          error: errorMessage,
        });
        errorCount++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Import Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully imported: ${successCount}`);
    console.log(`⏭️  Skipped (already exist): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📋 Total processed: ${restaurantAddresses.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(({ restaurant, error }) => {
        console.log(`   - ${restaurant}: ${error}`);
      });
    }

    console.log('\n🎉 Import complete!');

  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importRestaurantAddresses().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

export default importRestaurantAddresses;
