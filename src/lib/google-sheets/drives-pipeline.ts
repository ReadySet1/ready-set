/**
 * Drives Pipeline Orchestrator
 *
 * Reads delivery drives from the Google Sheet, calculates distances and costs
 * using the existing calculator engine, and writes results back to the sheet.
 */

import { getSheetData, batchUpdateSheetData, type SheetUpdateRange } from "./client";
import { parseDeliveryRows, filterByDateRange, type SheetDeliveryRow } from "./parser";
import {
  buildWriteColumnMap,
  OUTPUT_FIELDS,
  type WriteColumnMap,
} from "./column-map";
import { calculateDistancesForDrives } from "./distance-service";
import { resolveConfigId, getUnmappedVendors } from "@/lib/calculator/vendor-config-mapping";
import {
  calculateDriverPay,
  calculateDeliveryCost,
  type DriverPayInput,
  type DriverPayBreakdown,
} from "@/lib/calculator/delivery-cost-calculator";
import { getConfiguration } from "@/lib/calculator/client-configurations";

// ============================================================================
// TYPES
// ============================================================================

export interface DriveCalculationOutput {
  totalMileage: number;
  mileageRate: number;
  totalMileagePay: number;
  driverTotalBasePay: number;
  bonusVariance: number;
  readySetFee: number;
  readySetAddonFee: number;
  readySetMileageRate: number;
  readySetTotalFee: number;
  toll: number;
  tip: number;
  driverBonusPay: number;
  adjustment: number;
  totalDriverPay: number;
}

export interface DriveCalculationResult {
  rowIndex: number;
  status: "calculated" | "skipped" | "error";
  reason?: string;
  vendorName: string;
  driverName: string;
  client: string;
  date: string;
  headcount: number;
  foodCost: number;
  configId: string | null;
  output?: DriveCalculationOutput;
}

export interface PipelinePreviewResult {
  rows: DriveCalculationResult[];
  summary: {
    total: number;
    calculated: number;
    skipped: number;
    errors: number;
    unmappedVendors: string[];
  };
}

export interface PipelineWriteResult {
  written: number;
  errors: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

function parseNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,%]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function hasExistingValues(row: SheetDeliveryRow): boolean {
  // Check if any of the key output columns already have values
  return !!(
    row.totalDriverPay ||
    row.driverTotalBasePay ||
    row.readySetFee
  );
}

function mapBreakdownToOutput(
  breakdown: DriverPayBreakdown,
  totalMileage: number,
  vendorMileageRate: number,
): DriveCalculationOutput {
  return {
    totalMileage,
    mileageRate: breakdown.mileageRate,
    totalMileagePay: breakdown.totalMileagePay,
    driverTotalBasePay: breakdown.driverTotalBasePay,
    bonusVariance: 0, // Default — admin can adjust
    readySetFee: breakdown.readySetFee,
    readySetAddonFee: breakdown.readySetAddonFee,
    readySetMileageRate: vendorMileageRate,
    readySetTotalFee: breakdown.readySetTotalFee,
    toll: breakdown.bridgeToll,
    tip: breakdown.directTip,
    driverBonusPay: breakdown.driverBonusPay,
    adjustment: 0, // Default — admin can adjust
    totalDriverPay: breakdown.totalDriverPay,
  };
}

// ============================================================================
// PIPELINE FUNCTIONS
// ============================================================================

/**
 * Preview calculations for drives in a date range without writing to the sheet.
 *
 * @param vendorOverrides - Optional map of vendor name → config ID for manual overrides
 */
export async function previewCalculations(
  startDate: Date,
  endDate: Date,
  forceRecalculate: boolean = false,
  vendorOverrides?: Record<string, string>,
): Promise<PipelinePreviewResult> {
  // 1. Read and parse sheet data
  const rawRows = await getSheetData("Drives - Coolfire");
  const allRows = parseDeliveryRows(rawRows);
  const dateRows = filterByDateRange(allRows, startDate, endDate);

  // 2. Identify unmapped vendors
  const unmappedVendors = getUnmappedVendors(dateRows);

  // 3. Separate rows into calculate vs skip
  const toCalculate: SheetDeliveryRow[] = [];
  const results: DriveCalculationResult[] = [];

  for (const row of dateRows) {
    if (!forceRecalculate && hasExistingValues(row)) {
      results.push({
        rowIndex: row.rowIndex,
        status: "skipped",
        reason: "Already has values",
        vendorName: row.vendor,
        driverName: row.driverName,
        client: row.client,
        date: row.date,
        headcount: parseNumber(row.headcount),
        foodCost: parseNumber(row.cost),
        configId: null,
      });
      continue;
    }

    // Check for vendor type "Adjustment" — skip these
    if (row.vendor?.toLowerCase().includes("adjustment")) {
      results.push({
        rowIndex: row.rowIndex,
        status: "skipped",
        reason: "Adjustment row",
        vendorName: row.vendor,
        driverName: row.driverName,
        client: row.client,
        date: row.date,
        headcount: 0,
        foodCost: 0,
        configId: null,
      });
      continue;
    }

    toCalculate.push(row);
  }

  // 4. Calculate distances for rows missing mileage
  let distanceMap = new Map<number, number>();
  const rowsMissingMileage = toCalculate.filter(
    (r) => !r.totalMileage || parseNumber(r.totalMileage) === 0,
  );
  if (rowsMissingMileage.length > 0) {
    distanceMap = await calculateDistancesForDrives(rowsMissingMileage);
  }

  // 5. Calculate costs for each row
  for (const row of toCalculate) {
    const headcount = parseNumber(row.headcount);
    const foodCost = parseNumber(row.cost);

    // Resolve config — check overrides first
    const configId =
      vendorOverrides?.[row.vendor] ?? resolveConfigId(row.vendor);

    if (!configId) {
      results.push({
        rowIndex: row.rowIndex,
        status: "error",
        reason: `Unknown vendor: ${row.vendor}`,
        vendorName: row.vendor,
        driverName: row.driverName,
        client: row.client,
        date: row.date,
        headcount,
        foodCost,
        configId: null,
      });
      continue;
    }

    // Get mileage: use existing value, distance API result, or 0
    let totalMileage = parseNumber(row.totalMileage);
    if (totalMileage === 0) {
      totalMileage = distanceMap.get(row.rowIndex) ?? 0;
    }

    if (totalMileage === 0 && !row.vendorAddress && !row.clientAddress) {
      results.push({
        rowIndex: row.rowIndex,
        status: "error",
        reason: "Missing addresses for distance calculation",
        vendorName: row.vendor,
        driverName: row.driverName,
        client: row.client,
        date: row.date,
        headcount,
        foodCost,
        configId,
      });
      continue;
    }

    try {
      const config = getConfiguration(configId);
      const vendorMileageRate = config?.mileageRate ?? 3.0;

      const driverInput: DriverPayInput = {
        headcount,
        foodCost,
        totalMileage,
        numberOfDrives: 1, // Default — could be enhanced with drive grouping
        numberOfStops: 1,
        requiresBridge: false,
        bridgeToll: 0,
        clientConfigId: configId,
        bonusQualified: true,
        bonusQualifiedPercent: 100,
        directTip: 0,
        readySetAddonFee: 0,
      };

      const breakdown = calculateDriverPay(driverInput);
      const output = mapBreakdownToOutput(breakdown, totalMileage, vendorMileageRate);

      results.push({
        rowIndex: row.rowIndex,
        status: "calculated",
        vendorName: row.vendor,
        driverName: row.driverName,
        client: row.client,
        date: row.date,
        headcount,
        foodCost,
        configId,
        output,
      });
    } catch (error) {
      results.push({
        rowIndex: row.rowIndex,
        status: "error",
        reason:
          error instanceof Error ? error.message : "Calculation failed",
        vendorName: row.vendor,
        driverName: row.driverName,
        client: row.client,
        date: row.date,
        headcount,
        foodCost,
        configId,
      });
    }
  }

  // Sort by row index
  results.sort((a, b) => a.rowIndex - b.rowIndex);

  return {
    rows: results,
    summary: {
      total: dateRows.length,
      calculated: results.filter((r) => r.status === "calculated").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      unmappedVendors,
    },
  };
}

/**
 * Writes calculated results back to the Google Sheet.
 * Only writes rows with status "calculated" and a valid output.
 */
export async function writeCalculationsToSheet(
  results: DriveCalculationResult[],
): Promise<PipelineWriteResult> {
  // 1. Read headers to build column map
  const rawRows = await getSheetData("Drives - Coolfire", "1:1");
  const headers = rawRows[0];
  if (!headers) {
    return { written: 0, errors: ["Could not read sheet headers"] };
  }

  const columnMap = buildWriteColumnMap(headers);
  if (!columnMap) {
    return { written: 0, errors: ["Could not map output columns from headers"] };
  }

  // 2. Build update ranges for calculated rows
  const updates: SheetUpdateRange[] = [];
  const errors: string[] = [];

  const calculatedRows = results.filter(
    (r) => r.status === "calculated" && r.output,
  );

  for (const result of calculatedRows) {
    const output = result.output!;

    // Build values array matching the column positions
    // We need to write each field to its specific column
    for (const field of OUTPUT_FIELDS) {
      const letter = columnMap.fieldToLetter[field];
      if (!letter) continue;

      const value = output[field as keyof DriveCalculationOutput];
      if (value === undefined) continue;

      updates.push({
        range: `${letter}${result.rowIndex}`,
        values: [[typeof value === "number" ? Math.round(value * 100) / 100 : value]],
      });
    }
  }

  if (updates.length === 0) {
    return { written: 0, errors: [] };
  }

  // 3. Write to sheet in batches (Google API limit: ~100k cells per request)
  const BATCH_SIZE = 500; // ranges per batch
  let written = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    try {
      await batchUpdateSheetData("Drives - Coolfire", batch);
      written += batch.length;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Unknown write error";
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${msg}`);
    }
  }

  return {
    written: calculatedRows.length,
    errors,
  };
}
