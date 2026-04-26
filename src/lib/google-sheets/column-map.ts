/**
 * Header-based column mapping for Google Sheets write-back.
 * Uses dynamic header lookup so column positions are resilient to insertions.
 */

/** Maps output field names to their expected sheet header strings */
export const OUTPUT_FIELD_HEADERS: Record<string, string> = {
  totalMileage: "Total Mileage",
  mileageRate: "Mileage Rate",
  totalMileagePay: "Total Mileage Pay",
  driverTotalBasePay: "Driver Total Base Pay",
  bonusVariance: "Bonus Varience", // sic — matches sheet spelling
  readySetFee: "Ready Set Fee",
  readySetAddonFee: "ReadySet Add-on Fee",
  readySetMileageRate: "Ready Set Mileage Rate",
  readySetTotalFee: "Ready Set Total Fee",
  toll: "Toll",
  tip: "Tip",
  driverBonusPay: "Driver Bonus Pay",
  adjustment: "Adjustment",
  totalDriverPay: "Total Driver Pay",
};

/** All output field names in write order */
export const OUTPUT_FIELDS = Object.keys(OUTPUT_FIELD_HEADERS);

export interface WriteColumnMap {
  /** Maps field name → 0-based column index */
  fieldToIndex: Record<string, number>;
  /** Maps field name → column letter (e.g., "AJ") */
  fieldToLetter: Record<string, string>;
}

/**
 * Converts a 0-based column index to a spreadsheet column letter.
 * 0 → A, 25 → Z, 26 → AA, 35 → AJ, etc.
 */
export function indexToColumnLetter(index: number): string {
  let result = "";
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Builds a write column map from the sheet header row.
 * Returns null if any required output headers are missing.
 */
export function buildWriteColumnMap(headers: string[]): WriteColumnMap | null {
  const fieldToIndex: Record<string, number> = {};
  const fieldToLetter: Record<string, string> = {};
  const missing: string[] = [];

  for (const [field, header] of Object.entries(OUTPUT_FIELD_HEADERS)) {
    const index = headers.findIndex(
      (h) => h?.trim() === header,
    );
    if (index === -1) {
      missing.push(header);
      continue;
    }
    fieldToIndex[field] = index;
    fieldToLetter[field] = indexToColumnLetter(index);
  }

  if (missing.length > 0) {
    console.warn(
      `[column-map] Missing output headers in sheet: ${missing.join(", ")}`,
    );
  }

  // Allow partial maps — some fields may be missing
  if (Object.keys(fieldToIndex).length === 0) {
    return null;
  }

  return { fieldToIndex, fieldToLetter };
}

/**
 * Returns a cell reference like "AJ15" for a given field and 1-based row number.
 */
export function getOutputCellRef(
  columnMap: WriteColumnMap,
  fieldName: string,
  rowNumber: number,
): string | null {
  const letter = columnMap.fieldToLetter[fieldName];
  if (!letter) return null;
  return `${letter}${rowNumber}`;
}

/**
 * Returns a row range like "AJ15:AW15" spanning all output fields for a given row.
 */
export function getOutputRowRange(
  columnMap: WriteColumnMap,
  rowNumber: number,
): string | null {
  const indices = Object.values(columnMap.fieldToIndex);
  if (indices.length === 0) return null;

  const minCol = Math.min(...indices);
  const maxCol = Math.max(...indices);

  return `${indexToColumnLetter(minCol)}${rowNumber}:${indexToColumnLetter(maxCol)}${rowNumber}`;
}
