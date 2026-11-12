import { getSheetData } from "@/lib/google-sheets/client";
import { fetchMasterSheet } from "../index";
import { REAL_MASTER_SHEET_HEADERS, makeRow } from "./fixtures";

jest.mock("@/lib/google-sheets/client", () => ({
  getSheetData: jest.fn(),
}));

const mockGetSheetData = getSheetData as jest.MockedFunction<
  typeof getSheetData
>;

describe("fetchMasterSheet", () => {
  beforeEach(() => mockGetSheetData.mockReset());

  it("does not call Google when the master sheet id is not configured", async () => {
    const result = await fetchMasterSheet({
      GOOGLE_SHEETS_SHEET_ID: "legacy-quotes-id",
    });

    expect(result).toMatchObject({ configured: false });
    expect(mockGetSheetData).not.toHaveBeenCalled();
  });

  it("reads the master tab from the master spreadsheet and parses it", async () => {
    mockGetSheetData.mockResolvedValue([REAL_MASTER_SHEET_HEADERS, makeRow()]);

    const result = await fetchMasterSheet({
      GOOGLE_SHEETS_MASTER_SHEET_ID: "master-id",
    });

    expect(mockGetSheetData).toHaveBeenCalledWith(
      "Drives - Coolfire",
      undefined,
      "master-id",
    );
    expect(result.configured).toBe(true);
    if (!result.configured || !result.parsed.ok) throw new Error("expected ok");
    expect(result.parsed.valid).toHaveLength(1);
  });
});
