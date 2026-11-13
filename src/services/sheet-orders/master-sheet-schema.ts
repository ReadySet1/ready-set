import { z } from "zod";

/**
 * Typed intermediate shape of one drives-master-sheet row, after parsing and
 * before any mapping to orders. Dates and times stay zone-less on purpose:
 * the order's zone comes from its pickup address (see #694), which the
 * importer resolves in a later slice.
 */

const requiredText = z.string().min(1);
const optionalText = z.string().min(1).nullable();
/** Calendar date, `YYYY-MM-DD`. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Wall-clock time, 24-hour `HH:mm`. */
const time24 = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const amount = z.number().finite().nullable();

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const MasterSheetRowSchema = z.object({
  /** 1-based sheet row number (header = row 1). */
  rowNumber: z.number().int().min(2),
  /** "Coolfire Upload": `X` or a time when the row was pushed to Coolfire. */
  coolfireUploadMarker: optionalText,
  uploadedToCoolfire: z.boolean(),
  type: optionalText,
  isCancelled: z.boolean(),
  invoiceNumber: optionalText,
  date: isoDate,
  vendor: requiredText,
  routeOrder: requiredText,
  /** Shared `GRP…` prefix of a multi-pickup route, e.g. `GRPDAL0994`. */
  routeGroup: optionalText,
  pickupTime: time24,
  arrivalTime: time24.nullable(),
  completeTime: time24.nullable(),
  headcount: z.number().int().nonnegative().nullable(),
  foodCost: amount,
  timestamps: z.object({
    enrouteVendor: time24.nullable(),
    arrivedVendor: time24.nullable(),
    leftVendor: time24.nullable(),
    arrivedClient: time24.nullable(),
    completionTime: time24.nullable(),
  }),
  driverName: optionalText,
  backupDriver: optionalText,
  /** The sheet's "Status" column holds helpdesk agent names, not order state. */
  helpdeskAgent: optionalText,
  vendorPickupLocation: optionalText,
  vendorAddress: requiredText,
  client: optionalText,
  clientAddress: requiredText,
  specialNotes: optionalText,
  parkingInstructions: optionalText,
  adminNotes: optionalText,
  /** Free text in the real sheet (names show up in phone columns), kept raw. */
  contact: z.object({
    contactPhone: optionalText,
    primaryContact: optionalText,
    contactEmail: optionalText,
    locationPhone: optionalText,
    generalEmail: optionalText,
    website: optionalText,
  }),
  coolfireSuccessId: z.string().regex(UUID_PATTERN).nullable(),
  stopNumber: z.number().int().positive().nullable(),
  mileageToNextStop: amount,
  financials: z.object({
    driverMaxPayPerDrop: amount,
    driverBasePayPerDrop: amount,
    totalMileage: amount,
    mileageRate: amount,
    totalMileagePay: amount,
    driverTotalBasePay: amount,
    bonusVariance: amount,
    readySetFee: amount,
    readySetAddonFee: amount,
    readySetMileageRate: amount,
    readySetTotalFee: amount,
    toll: amount,
    tip: amount,
    driverBonusPay: amount,
    adjustment: amount,
    totalDriverPay: amount,
  }),
});

export type MasterSheetRow = z.infer<typeof MasterSheetRowSchema>;

export interface RowIssue {
  /** Dotted path into MasterSheetRow, e.g. `timestamps.arrivedClient`. */
  field: string;
  /** Sheet header the value came from. */
  header: string;
  message: string;
  /** The raw (trimmed) cell value. */
  value: string;
}

export interface ValidMasterSheetRow {
  rowNumber: number;
  row: MasterSheetRow;
  /** Optional cells that could not be parsed and were set to null. */
  warnings: RowIssue[];
}

export interface InvalidMasterSheetRow {
  rowNumber: number;
  errors: RowIssue[];
  warnings: RowIssue[];
  /** Trimmed cell values keyed by header, for the preview UI. */
  raw: Record<string, string>;
}

/** A problem with the header row that did not stop parsing. */
export interface HeaderWarning {
  header: string;
  message: string;
}

export type MasterSheetParseResult =
  | {
      ok: true;
      valid: ValidMasterSheetRow[];
      invalid: InvalidMasterSheetRow[];
      blankRowCount: number;
      /** Mapped optional headers absent from the sheet (their fields are null). */
      missingOptionalHeaders: string[];
      /** Mapped headers that appear more than once; the first column wins. */
      headerWarnings: HeaderWarning[];
    }
  | { ok: false; missingRequiredHeaders: string[] };
