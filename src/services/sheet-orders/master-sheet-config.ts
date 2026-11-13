/**
 * Configuration for the drives master sheet ("COOLFIRE MASTER UPLOAD").
 *
 * Deliberately separate from GOOGLE_SHEETS_SHEET_ID: that legacy var points at
 * the old "Web Quotes" spreadsheet in every environment (spec
 * docs/ready-set/specs/2026-07-09-sheet-orders-sync.md §1), so falling back to
 * it would read the wrong sheet. Going live is setting this one value once the
 * sheet is shared with the service account.
 */

export const MASTER_SHEET_ID_ENV = "GOOGLE_SHEETS_MASTER_SHEET_ID";

/** Tab that holds the drives, per the 2026-07-09 export. */
export const MASTER_SHEET_TAB_NAME = "Drives - Coolfire";

export type MasterSheetConfig =
  | { configured: true; spreadsheetId: string; tabName: string }
  | { configured: false; reason: string };

/** `/spreadsheets/d/<id>` (also `/spreadsheets/u/0/d/<id>`) in a Sheets URL. */
const SHEETS_URL_ID_PATTERN = /\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/;

/**
 * Accepts the bare id or a pasted Google Sheets URL. Returns null when the
 * value looks like a URL but carries no spreadsheet id.
 */
function toSpreadsheetId(value: string): string | null {
  const fromUrl = SHEETS_URL_ID_PATTERN.exec(value)?.[1];
  if (fromUrl) return fromUrl;
  if (value.includes("/")) return null;
  return value;
}

export function getMasterSheetConfig(
  env: Record<string, string | undefined> = process.env,
): MasterSheetConfig {
  const value = env[MASTER_SHEET_ID_ENV]?.trim();
  if (!value) {
    return {
      configured: false,
      reason: `${MASTER_SHEET_ID_ENV} is not set. Share the master sheet with the service account, then set it to the spreadsheet id.`,
    };
  }
  const spreadsheetId = toSpreadsheetId(value);
  if (!spreadsheetId) {
    return {
      configured: false,
      reason: `${MASTER_SHEET_ID_ENV} looks like a URL but has no spreadsheet id. Use the id from docs.google.com/spreadsheets/d/<id>/edit, or that full URL.`,
    };
  }
  return { configured: true, spreadsheetId, tabName: MASTER_SHEET_TAB_NAME };
}
