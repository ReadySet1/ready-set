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

  it.each([
    "https://docs.google.com/spreadsheets/d/1AbC-dEf_123/edit#gid=0",
    "https://docs.google.com/spreadsheets/d/1AbC-dEf_123/edit?usp=sharing",
    "  https://docs.google.com/spreadsheets/d/1AbC-dEf_123  ",
    "docs.google.com/spreadsheets/u/0/d/1AbC-dEf_123/",
  ])("extracts the spreadsheet id from a pasted URL %p", (value) => {
    expect(getMasterSheetConfig({ [MASTER_SHEET_ID_ENV]: value })).toEqual({
      configured: true,
      spreadsheetId: "1AbC-dEf_123",
      tabName: "Drives - Coolfire",
    });
  });

  it("is not configured when the value is a URL without a spreadsheet id", () => {
    expect(
      getMasterSheetConfig({
        [MASTER_SHEET_ID_ENV]: "https://drive.google.com/drive/folders/xyz",
      }),
    ).toEqual({
      configured: false,
      reason: expect.stringContaining("spreadsheet id"),
    });
  });

  it("never falls back to the legacy GOOGLE_SHEETS_SHEET_ID (Web Quotes sheet)", () => {
    expect(
      getMasterSheetConfig({ GOOGLE_SHEETS_SHEET_ID: "legacy-quotes-id" }),
    ).toMatchObject({ configured: false });
  });
});
