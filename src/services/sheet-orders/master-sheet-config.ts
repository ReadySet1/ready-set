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

export function getMasterSheetConfig(
  env: Record<string, string | undefined> = process.env,
): MasterSheetConfig {
  const spreadsheetId = env[MASTER_SHEET_ID_ENV]?.trim();
  if (!spreadsheetId) {
    return {
      configured: false,
      reason: `${MASTER_SHEET_ID_ENV} is not set. Share the master sheet with the service account, then set it to the spreadsheet id.`,
    };
  }
  return { configured: true, spreadsheetId, tabName: MASTER_SHEET_TAB_NAME };
}
