import {
  getMasterSheetConfig,
  MASTER_SHEET_ID_ENV,
  MASTER_SHEET_TAB_NAME,
} from "../master-sheet-config";

describe("getMasterSheetConfig", () => {
  it("reads the master sheet id from its own env var", () => {
    expect(
      getMasterSheetConfig({ [MASTER_SHEET_ID_ENV]: "  master-id  " }),
    ).toEqual({
      configured: true,
      spreadsheetId: "master-id",
      tabName: "Drives - Coolfire",
    });
  });

  it("uses the env var name GOOGLE_SHEETS_MASTER_SHEET_ID", () => {
    expect(MASTER_SHEET_ID_ENV).toBe("GOOGLE_SHEETS_MASTER_SHEET_ID");
    expect(MASTER_SHEET_TAB_NAME).toBe("Drives - Coolfire");
  });

  it("is not configured when the var is unset or blank", () => {
    for (const env of [{}, { [MASTER_SHEET_ID_ENV]: "   " }]) {
      expect(getMasterSheetConfig(env)).toEqual({
        configured: false,
        reason: expect.stringContaining("GOOGLE_SHEETS_MASTER_SHEET_ID"),
      });
    }
  });

  it("never falls back to the legacy GOOGLE_SHEETS_SHEET_ID (Web Quotes sheet)", () => {
    expect(
      getMasterSheetConfig({ GOOGLE_SHEETS_SHEET_ID: "legacy-quotes-id" }),
    ).toMatchObject({ configured: false });
  });
});
