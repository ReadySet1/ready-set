/**
 * Sheet → orders sync, prep slice: read and parse the drives master sheet.
 * Nothing here writes to the database; mapping rows to orders is the next
 * slice (docs/ready-set/specs/2026-07-09-sheet-orders-sync.md, Phase 1).
 */

import { getSheetData } from "@/lib/google-sheets/client";
import { getMasterSheetConfig } from "./master-sheet-config";
import { parseMasterSheetRows } from "./master-sheet-parser";
import type { MasterSheetParseResult } from "./master-sheet-schema";

export type FetchMasterSheetResult =
  | { configured: false; reason: string }
  | { configured: true; spreadsheetId: string; parsed: MasterSheetParseResult };

export async function fetchMasterSheet(
  env: Record<string, string | undefined> = process.env,
): Promise<FetchMasterSheetResult> {
  const config = getMasterSheetConfig(env);
  if (!config.configured) return config;

  const rows = await getSheetData(config.tabName, undefined, config.spreadsheetId);
  return {
    configured: true,
    spreadsheetId: config.spreadsheetId,
    parsed: parseMasterSheetRows(rows),
  };
}

export * from "./master-sheet-config";
export * from "./master-sheet-parser";
export * from "./master-sheet-schema";
