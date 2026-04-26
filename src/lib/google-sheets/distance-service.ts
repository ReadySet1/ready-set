/**
 * Batch distance calculation service for drives pipeline.
 * Calls Google Distance Matrix API server-side with deduplication and rate limiting.
 */

import type { SheetDeliveryRow } from "./parser";

const GOOGLE_DISTANCE_MATRIX_URL =
  "https://maps.googleapis.com/maps/api/distancematrix/json";
const METERS_TO_MILES = 0.000621371;
const MAX_ELEMENTS_PER_REQUEST = 25;
const BATCH_DELAY_MS = 200;

interface GoogleDistanceMatrixElement {
  status: string;
  distance?: { value: number; text: string };
  duration?: { value: number; text: string };
}

interface GoogleDistanceMatrixRow {
  elements: GoogleDistanceMatrixElement[];
}

interface GoogleDistanceMatrixResponse {
  status: string;
  error_message?: string;
  origin_addresses: string[];
  destination_addresses: string[];
  rows: GoogleDistanceMatrixRow[];
}

interface AddressPair {
  origin: string;
  destination: string;
  key: string;
}

function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ");
}

function makeKey(origin: string, destination: string): string {
  return `${normalizeAddress(origin)}|${normalizeAddress(destination)}`;
}

async function fetchDistanceMatrix(
  origins: string[],
  destinations: string[],
  apiKey: string,
): Promise<GoogleDistanceMatrixResponse> {
  const params = new URLSearchParams({
    origins: origins.join("|"),
    destinations: destinations.join("|"),
    key: apiKey,
    units: "imperial",
    mode: "driving",
  });

  const response = await fetch(`${GOOGLE_DISTANCE_MATRIX_URL}?${params}`);
  if (!response.ok) {
    throw new Error(
      `Google Distance Matrix API returned ${response.status}`,
    );
  }

  const data: GoogleDistanceMatrixResponse = await response.json();
  if (data.status !== "OK") {
    const detail = data.error_message ? ` — ${data.error_message}` : "";
    throw new Error(`Distance Matrix error: ${data.status}${detail}`);
  }

  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates distances for delivery rows that are missing mileage.
 * Returns a map of rowIndex → distance in miles.
 *
 * Deduplicates identical address pairs and caches results within the batch.
 */
export async function calculateDistancesForDrives(
  rows: SheetDeliveryRow[],
): Promise<Map<number, number>> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  // Build unique address pairs for rows missing mileage
  const pairCache = new Map<string, number>(); // key → miles
  const rowToPairKey = new Map<number, string>(); // rowIndex → key
  const uniquePairs: AddressPair[] = [];

  for (const row of rows) {
    // Skip rows that already have mileage
    const existingMileage = parseFloat(row.totalMileage);
    if (!isNaN(existingMileage) && existingMileage > 0) {
      continue;
    }

    if (!row.vendorAddress || !row.clientAddress) continue;

    const key = makeKey(row.vendorAddress, row.clientAddress);
    rowToPairKey.set(row.rowIndex, key);

    if (!pairCache.has(key)) {
      pairCache.set(key, -1); // placeholder
      uniquePairs.push({
        origin: normalizeAddress(row.vendorAddress),
        destination: normalizeAddress(row.clientAddress),
        key,
      });
    }
  }

  // Batch API calls — one origin + one destination per pair
  // Google Distance Matrix: origins × destinations = elements, max 25 per request
  for (let i = 0; i < uniquePairs.length; i += MAX_ELEMENTS_PER_REQUEST) {
    const batch = uniquePairs.slice(i, i + MAX_ELEMENTS_PER_REQUEST);

    // Use one-to-one mapping: each pair is a separate origin→destination
    for (const pair of batch) {
      try {
        const data = await fetchDistanceMatrix(
          [pair.origin],
          [pair.destination],
          apiKey,
        );

        const element = data.rows[0]?.elements[0];
        if (element?.status === "OK" && element.distance) {
          const miles =
            Math.round(element.distance.value * METERS_TO_MILES * 10) / 10;
          pairCache.set(pair.key, miles);
        } else {
          console.warn(
            `[distance-service] No distance for: ${pair.origin} → ${pair.destination}`,
            element?.status,
          );
          pairCache.set(pair.key, 0);
        }
      } catch (error) {
        console.error(
          `[distance-service] Error for: ${pair.origin} → ${pair.destination}`,
          error,
        );
        pairCache.set(pair.key, 0);
      }
    }

    // Rate limit between batches
    if (i + MAX_ELEMENTS_PER_REQUEST < uniquePairs.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Map results back to row indices
  const result = new Map<number, number>();
  for (const [rowIndex, key] of rowToPairKey) {
    const miles = pairCache.get(key);
    if (miles !== undefined && miles >= 0) {
      result.set(rowIndex, miles);
    }
  }

  return result;
}
