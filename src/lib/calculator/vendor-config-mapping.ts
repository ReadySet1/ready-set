/**
 * Maps vendor names from the Google Sheet to calculator client configuration IDs.
 * Uses exact match first, then partial/fuzzy matching for variations like
 * "Try Hungry - ATX" or "Try Hungry - SJC".
 */

import { CLIENT_CONFIGURATIONS } from "./client-configurations";

/** Explicit vendor name → config ID mapping (normalized lowercase keys) */
const VENDOR_TO_CONFIG: [string, string][] = [
  ["destino", "ready-set-food-standard"],
  ["kasa", "kasa"],
  ["catervalley", "cater-valley"],
  ["cater valley", "cater-valley"],
  ["try hungry", "try-hungry"],
  ["hy food company", "hy-food-company-direct"],
  ["hy food", "hy-food-company-direct"],
  ["la barbeque", "ready-set-food-standard"],
  ["la bbq", "ready-set-food-standard"],
];

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Resolves a vendor name from the sheet to a calculator config ID.
 * Returns null if no match found.
 */
export function resolveConfigId(vendorName: string): string | null {
  if (!vendorName) return null;

  const normalized = normalize(vendorName);

  // 1. Exact match
  for (const [key, configId] of VENDOR_TO_CONFIG) {
    if (normalized === key) return configId;
  }

  // 2. Partial match — vendor name starts with or contains a known key
  for (const [key, configId] of VENDOR_TO_CONFIG) {
    if (normalized.startsWith(key) || normalized.includes(key)) {
      return configId;
    }
  }

  // 3. Try matching against vendorName in CLIENT_CONFIGURATIONS
  for (const config of Object.values(CLIENT_CONFIGURATIONS)) {
    const configVendor = normalize(config.vendorName);
    if (normalized.includes(configVendor) || configVendor.includes(normalized)) {
      return config.id;
    }
  }

  return null;
}

/**
 * Returns distinct vendor names from rows that cannot be resolved to a config.
 */
export function getUnmappedVendors(
  rows: { vendor: string }[],
): string[] {
  const seen = new Set<string>();
  const unmapped: string[] = [];

  for (const row of rows) {
    const vendor = row.vendor?.trim();
    if (!vendor || seen.has(vendor.toLowerCase())) continue;
    seen.add(vendor.toLowerCase());

    if (!resolveConfigId(vendor)) {
      unmapped.push(vendor);
    }
  }

  return unmapped;
}

/**
 * Returns all available config IDs for use in manual override dropdowns.
 */
export function getAvailableConfigs(): { id: string; label: string }[] {
  return Object.values(CLIENT_CONFIGURATIONS)
    .filter((c) => c.isActive)
    .map((c) => ({
      id: c.id,
      label: `${c.clientName} (${c.vendorName})`,
    }));
}
