/**
 * Pure parser for the drives master sheet ("COOLFIRE MASTER UPLOAD" →
 * "Drives - Coolfire"). Maps raw Sheets API rows to typed, validated
 * MasterSheetRow objects and reports problems per row. It never throws on bad
 * data and has no I/O: fetching and importing are separate slices.
 *
 * Column source: the 2026-07-09 CSV exports of the real sheet (75 columns),
 * see docs/ready-set/specs/2026-07-09-sheet-orders-sync.md §3.5.
 *
 * Not mapped on purpose: the "Old …", "Differance", "Discount", profit and
 * "% Bonus Quilified" columns (sheet-side bookkeeping) and the
 * "… (Duplicate)" block (a Coolfire mirror of columns already mapped).
 */

import {
  MasterSheetRowSchema,
  UUID_PATTERN,
  type HeaderWarning,
  type InvalidMasterSheetRow,
  type MasterSheetParseResult,
  type RowIssue,
  type ValidMasterSheetRow,
} from "./master-sheet-schema";

/** Real header text (whitespace-normalized; sheet spellings kept). */
export const MASTER_SHEET_HEADERS = {
  coolfireUpload: "Coolfire Upload",
  type: "Type",
  invoiceNumber: "Invoice #",
  date: "Date",
  vendor: "Vendor",
  routeOrder: "Route/Order",
  pickupTime: "Pick Up",
  arrivalTime: "Arrival",
  completeTime: "Complete",
  headcount: "Headcount / Total Drops",
  foodCost: "Cost",
  enrouteVendor: "Enroute Vendor",
  arrivedVendor: "Arrived Vendor",
  leftVendor: "Left Vendor",
  arrivedClient: "Arrived Client",
  completionTime: "Completion Time",
  driverName: "Driver",
  backupDriver: "Backup Driver",
  helpdeskAgent: "Status",
  vendorPickupLocation: "Vendor Pick-Up Location",
  vendorAddress: "Vendor Address",
  client: "Client",
  clientAddress: "Client Address",
  specialNotes: "Special Notes",
  parkingInstructions: "Parking/Loading Instructions",
  adminNotes: "Admin Notes",
  contactPhone: "Contact Phone",
  primaryContact: "Primary Contact",
  contactEmail: "Contact Email",
  locationPhone: "Location Phone",
  generalEmail: "General Email",
  website: "Website",
  coolfireSuccessId: "Coolfire Success ID",
  driverMaxPayPerDrop: "Driver Max Pay Per Drop",
  driverBasePayPerDrop: "Driver Base Pay Per Drop",
  totalMileage: "Total Mileage",
  mileageRate: "Mileage Rate",
  totalMileagePay: "Total Mileage Pay",
  driverTotalBasePay: "Driver Total Base Pay",
  bonusVariance: "Bonus Varience",
  readySetFee: "Ready Set Fee",
  readySetAddonFee: "ReadySet Add-on Fee",
  readySetMileageRate: "Ready Set Mileage Rate",
  readySetTotalFee: "Ready Set Total Fee",
  toll: "Toll",
  tip: "Tip",
  driverBonusPay: "Driver Bonus Pay",
  adjustment: "Adjustment",
  totalDriverPay: "Total Driver Pay",
  stopNumber: "Stop #",
  mileageToNextStop: "Mileage to Next Stop",
} as const;

const H = MASTER_SHEET_HEADERS;

/** A row cannot become an order without these columns. */
export const MASTER_SHEET_REQUIRED_HEADERS: string[] = [
  H.date,
  H.vendor,
  H.routeOrder,
  H.pickupTime,
  H.vendorAddress,
  H.clientAddress,
];

function normalizeHeader(header: string | undefined): string {
  return (header ?? "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Value parsers: return null when the input can't be read.
// ---------------------------------------------------------------------------

/** `M/D/YY` or `M/D/YYYY` (zero-padded or not) → `YYYY-MM-DD`. */
export function parseSheetDate(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Sheet time → 24-hour `HH:mm`. Accepts `8:00 AM`, `1:15PM`, `8 AM`,
 * `10:30: AM` (stray colon seen in the real export) and `14:30`.
 */
export function parseSheetTime(value: string): string | null {
  const s = value.toUpperCase().replace(/\./g, "").trim();
  const pad = (n: number) => String(n).padStart(2, "0");

  const twelve = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*:?\s*(AM|PM)$/.exec(s);
  if (twelve) {
    const hour = Number(twelve[1]);
    const minute = Number(twelve[2] ?? "0");
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const hour24 = (hour % 12) + (twelve[3] === "PM" ? 12 : 0);
    return `${pad(hour24)}:${pad(minute)}`;
  }

  const twentyFour = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour > 23 || minute > 59) return null;
    return `${pad(hour)}:${pad(minute)}`;
  }

  return null;
}

/** `$1,250.00`, `-$5.00`, `($5.00)`, `13.4` → number. */
export function parseSheetAmount(value: string): number | null {
  let s = value.replace(/[\s$,]/g, "");
  let negative = false;
  const parens = /^\((.*)\)$/.exec(s);
  if (parens) {
    negative = true;
    s = parens[1] ?? "";
  }
  if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return negative ? -n : n;
}

/**
 * Error values a formula cell renders as (`#N/A`, `#REF!`, …). They are text to
 * the Sheets API, so without this check they would pass as real addresses.
 */
const SPREADSHEET_ERROR_PATTERN =
  /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!|SPILL!|CALC!)$/i;

export function isSpreadsheetError(value: string): boolean {
  return SPREADSHEET_ERROR_PATTERN.test(value.trim());
}

const SPREADSHEET_ERROR_MESSAGE = "Invalid value (spreadsheet error)";

function parseWholeNumber(value: string): number | null {
  const s = value.replace(/,/g, "");
  return /^\d+$/.test(s) ? Number(s) : null;
}

// ---------------------------------------------------------------------------
// Row reader: pulls cells by header and records issues.
// ---------------------------------------------------------------------------

class RowReader {
  readonly errors: RowIssue[] = [];
  readonly warnings: RowIssue[] = [];

  constructor(
    private readonly cells: string[],
    private readonly columnIndex: Map<string, number>,
  ) {}

  cell(header: string): string {
    const index = this.columnIndex.get(header);
    if (index === undefined) return "";
    return (this.cells[index] ?? "").trim();
  }

  requiredText(field: string, header: string): string {
    const value = this.cell(header);
    if (!value) {
      this.errors.push({ field, header, message: "Required", value });
    } else if (isSpreadsheetError(value)) {
      this.errors.push({ field, header, message: SPREADSHEET_ERROR_MESSAGE, value });
    }
    return value;
  }

  text(field: string, header: string): string | null {
    const value = this.cell(header);
    if (!value) return null;
    if (isSpreadsheetError(value)) {
      this.warnings.push({
        field,
        header,
        message: `${SPREADSHEET_ERROR_MESSAGE}; value ignored`,
        value,
      });
      return null;
    }
    return value;
  }

  required<T>(
    field: string,
    header: string,
    parse: (v: string) => T | null,
    expected: string,
  ): T | null {
    const value = this.cell(header);
    if (!value) {
      this.errors.push({ field, header, message: "Required", value });
      return null;
    }
    const parsed = parse(value);
    if (parsed === null) {
      this.errors.push({ field, header, message: `Invalid ${expected}`, value });
    }
    return parsed;
  }

  optional<T>(
    field: string,
    header: string,
    parse: (v: string) => T | null,
    expected: string,
  ): T | null {
    const value = this.cell(header);
    if (!value) return null;
    const parsed = parse(value);
    if (parsed === null) {
      this.warnings.push({
        field,
        header,
        message: `Invalid ${expected}; value ignored`,
        value,
      });
    }
    return parsed;
  }
}

const DATE = "date (expected M/D/YY)";
const TIME = "time (expected h:mm AM/PM)";
const AMOUNT = "amount";

function readRow(reader: RowReader, rowNumber: number) {
  const r = reader;
  const time = (field: string, header: string) =>
    r.optional(field, header, parseSheetTime, TIME);
  const money = (field: string, header: string) =>
    r.optional(field, header, parseSheetAmount, AMOUNT);

  const coolfireUploadMarker = r.text("coolfireUploadMarker", H.coolfireUpload);
  const type = r.text("type", H.type);
  const routeOrder = r.requiredText("routeOrder", H.routeOrder);
  const successId = r.optional(
    "coolfireSuccessId",
    H.coolfireSuccessId,
    (v) => (UUID_PATTERN.test(v.toLowerCase()) ? v.toLowerCase() : null),
    "UUID",
  );
  const stopNumber = r.optional(
    "stopNumber",
    H.stopNumber,
    (v) => {
      const n = parseWholeNumber(v);
      return n !== null && n > 0 ? n : null;
    },
    "stop number",
  );

  // Field order here = order of issues in the report; keep it close to the
  // sheet's column order.
  return {
    rowNumber,
    coolfireUploadMarker,
    uploadedToCoolfire: coolfireUploadMarker !== null,
    type,
    // Prefix match: the sheet has "Cancelled", "Canceled" and
    // "Cancelled - <reason>"; any of them must not import as a live order.
    isCancelled: type !== null && /^cancel/i.test(type),
    invoiceNumber: r.text("invoiceNumber", H.invoiceNumber),
    date: r.required("date", H.date, parseSheetDate, DATE),
    vendor: r.requiredText("vendor", H.vendor),
    routeOrder,
    routeGroup: /^(GRP[A-Z0-9]+)-/i.exec(routeOrder)?.[1] ?? null,
    pickupTime: r.required("pickupTime", H.pickupTime, parseSheetTime, TIME),
    arrivalTime: time("arrivalTime", H.arrivalTime),
    completeTime: time("completeTime", H.completeTime),
    headcount: r.optional("headcount", H.headcount, parseWholeNumber, "headcount"),
    foodCost: money("foodCost", H.foodCost),
    timestamps: {
      enrouteVendor: time("timestamps.enrouteVendor", H.enrouteVendor),
      arrivedVendor: time("timestamps.arrivedVendor", H.arrivedVendor),
      leftVendor: time("timestamps.leftVendor", H.leftVendor),
      arrivedClient: time("timestamps.arrivedClient", H.arrivedClient),
      completionTime: time("timestamps.completionTime", H.completionTime),
    },
    driverName: r.text("driverName", H.driverName),
    backupDriver: r.text("backupDriver", H.backupDriver),
    helpdeskAgent: r.text("helpdeskAgent", H.helpdeskAgent),
    vendorPickupLocation: r.text("vendorPickupLocation", H.vendorPickupLocation),
    vendorAddress: r.requiredText("vendorAddress", H.vendorAddress),
    client: r.text("client", H.client),
    clientAddress: r.requiredText("clientAddress", H.clientAddress),
    specialNotes: r.text("specialNotes", H.specialNotes),
    parkingInstructions: r.text("parkingInstructions", H.parkingInstructions),
    adminNotes: r.text("adminNotes", H.adminNotes),
    contact: {
      contactPhone: r.text("contact.contactPhone", H.contactPhone),
      primaryContact: r.text("contact.primaryContact", H.primaryContact),
      contactEmail: r.text("contact.contactEmail", H.contactEmail),
      locationPhone: r.text("contact.locationPhone", H.locationPhone),
      generalEmail: r.text("contact.generalEmail", H.generalEmail),
      website: r.text("contact.website", H.website),
    },
    coolfireSuccessId: successId,
    stopNumber,
    mileageToNextStop: money("mileageToNextStop", H.mileageToNextStop),
    financials: {
      driverMaxPayPerDrop: money("financials.driverMaxPayPerDrop", H.driverMaxPayPerDrop),
      driverBasePayPerDrop: money("financials.driverBasePayPerDrop", H.driverBasePayPerDrop),
      totalMileage: money("financials.totalMileage", H.totalMileage),
      mileageRate: money("financials.mileageRate", H.mileageRate),
      totalMileagePay: money("financials.totalMileagePay", H.totalMileagePay),
      driverTotalBasePay: money("financials.driverTotalBasePay", H.driverTotalBasePay),
      bonusVariance: money("financials.bonusVariance", H.bonusVariance),
      readySetFee: money("financials.readySetFee", H.readySetFee),
      readySetAddonFee: money("financials.readySetAddonFee", H.readySetAddonFee),
      readySetMileageRate: money("financials.readySetMileageRate", H.readySetMileageRate),
      readySetTotalFee: money("financials.readySetTotalFee", H.readySetTotalFee),
      toll: money("financials.toll", H.toll),
      tip: money("financials.tip", H.tip),
      driverBonusPay: money("financials.driverBonusPay", H.driverBonusPay),
      adjustment: money("financials.adjustment", H.adjustment),
      totalDriverPay: money("financials.totalDriverPay", H.totalDriverPay),
    },
  };
}

function rawByHeader(
  cells: string[],
  columnIndex: Map<string, number>,
): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [header, index] of columnIndex) {
    raw[header] = (cells[index] ?? "").trim();
  }
  return raw;
}

/**
 * Parses the full sheet (`rows[0]` = header row). Columns are resolved by
 * header text, so reordering or inserting columns in the sheet is harmless.
 */
export function parseMasterSheetRows(rows: string[][]): MasterSheetParseResult {
  const columnIndex = new Map<string, number>();
  const repeatedColumns = new Map<string, number[]>();
  (rows[0] ?? []).forEach((header, i) => {
    const name = normalizeHeader(header);
    if (!name) return;
    if (!columnIndex.has(name)) {
      columnIndex.set(name, i);
    } else {
      repeatedColumns.set(name, [...(repeatedColumns.get(name) ?? []), i]);
    }
  });

  const missingRequiredHeaders = MASTER_SHEET_REQUIRED_HEADERS.filter(
    (h) => !columnIndex.has(h),
  );
  if (missingRequiredHeaders.length > 0) {
    return { ok: false, missingRequiredHeaders };
  }

  const missingOptionalHeaders = Object.values(MASTER_SHEET_HEADERS).filter(
    (h) => !columnIndex.has(h) && !MASTER_SHEET_REQUIRED_HEADERS.includes(h),
  );

  const mappedHeaders = new Set<string>(Object.values(MASTER_SHEET_HEADERS));
  const headerWarnings: HeaderWarning[] = [];
  for (const [header, extra] of repeatedColumns) {
    if (!mappedHeaders.has(header)) continue;
    const first = (columnIndex.get(header) ?? 0) + 1;
    const others = extra.map((i) => i + 1).join(", ");
    headerWarnings.push({
      header,
      message: `Header "${header}" is repeated (column ${first}, also ${others}); using column ${first}.`,
    });
  }

  const valid: ValidMasterSheetRow[] = [];
  const invalid: InvalidMasterSheetRow[] = [];
  let blankRowCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i] ?? [];
    const rowNumber = i + 1;
    if (cells.every((c) => !c?.trim())) {
      blankRowCount++;
      continue;
    }

    const reader = new RowReader(cells, columnIndex);
    const candidate = readRow(reader, rowNumber);

    if (reader.errors.length === 0) {
      // Final contract check; the reader should already guarantee it.
      const checked = MasterSheetRowSchema.safeParse(candidate);
      if (checked.success) {
        valid.push({ rowNumber, row: checked.data, warnings: reader.warnings });
        continue;
      }
      for (const issue of checked.error.issues) {
        reader.errors.push({
          field: issue.path.join("."),
          header: "",
          message: issue.message,
          value: "",
        });
      }
    }

    invalid.push({
      rowNumber,
      errors: reader.errors,
      warnings: reader.warnings,
      raw: rawByHeader(cells, columnIndex),
    });
  }

  return {
    ok: true,
    valid,
    invalid,
    blankRowCount,
    missingOptionalHeaders,
    headerWarnings,
  };
}
