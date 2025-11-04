/**
 * Flower Delivery Pricing Data
 *
 * This file contains all pricing information for flower package delivery across 4 Bay Area regions.
 *
 * @description Pricing is zone-based with the following structure:
 * - 4 regions: Peninsula South, East Bay Middle, Peninsula North, San Francisco Area
 * - Each region has 11 delivery zones with varying costs ($10-$15)
 * - Toll flags indicate bridge crossings that incur additional fees
 *
 * @maintenance
 * - Update pricing here instead of the component for easier maintenance
 * - Consider migrating to CMS (Sanity) or environment variables for dynamic pricing
 * - Ensure zone codes match the operational delivery zones
 *
 * @see FlowerPricingLandingPage.tsx - Component that displays this data
 */

export type RegionKey = "peninsula-south" | "east-bay-middle" | "peninsula-north" | "san-francisco";

export interface PricingRow {
  /** Display name of the delivery area */
  area: string;
  /** Zone code (01-11) for operational reference */
  zone: string;
  /** Delivery cost in USD format (e.g., "$10") */
  cost: string;
  /** True if delivery requires bridge toll crossing */
  hasToll?: boolean;
}

/**
 * Regional pricing data for flower package delivery
 *
 * Each region contains:
 * - name: Display name for the region tab
 * - data: Array of pricing rows sorted by cost (ascending)
 */
export const regionalPricing: Record<RegionKey, { name: string; data: PricingRow[] }> = {
  "peninsula-south": {
    name: "Peninsula South",
    data: [
      { area: "Peninsula South", zone: "03", cost: "$10" },
      { area: "Peninsula North", zone: "09", cost: "$11" },
      { area: "San Jose West", zone: "02", cost: "$12" },
      { area: "San Francisco Area", zone: "11", cost: "$12" },
      { area: "East Bay South", zone: "06", cost: "$12", hasToll: true },
      { area: "East Bay Middle", zone: "07", cost: "$13", hasToll: true },
      { area: "Peninsula Coast", zone: "10", cost: "$13" },
      { area: "San Jose East", zone: "01", cost: "$14" },
      { area: "East Bay Richmond", zone: "05", cost: "$15", hasToll: true },
      { area: "East Bay Concord", zone: "04", cost: "$15", hasToll: true },
      { area: "Marin", zone: "08", cost: "$15", hasToll: true },
    ],
  },
  "east-bay-middle": {
    name: "East Bay Middle",
    data: [
      { area: "East Bay Middle", zone: "07", cost: "$10" },
      { area: "San Francisco Area", zone: "11", cost: "$11", hasToll: true },
      { area: "East Bay South", zone: "06", cost: "$12" },
      { area: "East Bay Richmond", zone: "05", cost: "$12" },
      { area: "East Bay Concord", zone: "04", cost: "$12" },
      { area: "Peninsula North", zone: "09", cost: "$13", hasToll: true },
      { area: "Peninsula South", zone: "03", cost: "$14", hasToll: true },
      { area: "San Jose West", zone: "02", cost: "$15", hasToll: true },
      { area: "San Jose East", zone: "01", cost: "$15" },
      { area: "Marin", zone: "08", cost: "$15", hasToll: true },
      { area: "Peninsula Coast", zone: "10", cost: "$15", hasToll: true },
    ],
  },
  "peninsula-north": {
    name: "Peninsula North",
    data: [
      { area: "Peninsula North", zone: "09", cost: "$10" },
      { area: "Peninsula South", zone: "03", cost: "$11" },
      { area: "San Jose West", zone: "02", cost: "$12" },
      { area: "San Francisco Area", zone: "11", cost: "$12" },
      { area: "East Bay South", zone: "06", cost: "$12", hasToll: true },
      { area: "East Bay Middle", zone: "07", cost: "$13", hasToll: true },
      { area: "Peninsula Coast", zone: "10", cost: "$13" },
      { area: "San Jose East", zone: "01", cost: "$14" },
      { area: "East Bay Richmond", zone: "05", cost: "$15", hasToll: true },
      { area: "East Bay Concord", zone: "04", cost: "$15", hasToll: true },
      { area: "Marin", zone: "08", cost: "$15", hasToll: true },
    ],
  },
  "san-francisco": {
    name: "San Francisco Area",
    data: [
      { area: "San Francisco Area", zone: "11", cost: "$10" },
      { area: "North Peninsula Area", zone: "09", cost: "$11" },
      { area: "East Bay Oakland/Alameda Area", zone: "07", cost: "$11", hasToll: true },
      { area: "East Bay Richmond Area", zone: "05", cost: "$12", hasToll: true },
      { area: "Peninsula South Area", zone: "03", cost: "$12" },
      { area: "East Bay Hayward Area", zone: "06", cost: "$13", hasToll: true },
      { area: "Peninsula Coast Area", zone: "10", cost: "$13" },
      { area: "San Jose West Area", zone: "02", cost: "$13" },
      { area: "Marin Area", zone: "08", cost: "$13", hasToll: true },
      { area: "East Bay Concord Area", zone: "04", cost: "$14", hasToll: true },
      { area: "San Jose Area", zone: "01", cost: "$14" },
    ],
  },
};
