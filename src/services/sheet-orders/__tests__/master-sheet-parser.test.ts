import { parseMasterSheetRows } from "../master-sheet-parser";
import { REAL_MASTER_SHEET_HEADERS, makeRow } from "./fixtures";

function parseOne(overrides: Record<string, string> = {}) {
  const result = parseMasterSheetRows([
    REAL_MASTER_SHEET_HEADERS,
    makeRow(overrides),
  ]);
  if (!result.ok) throw new Error("expected headers to be accepted");
  return result;
}

describe("parseMasterSheetRows", () => {
  describe("valid row", () => {
    it("maps every documented column to a typed field", () => {
      const result = parseOne();

      expect(result.invalid).toEqual([]);
      expect(result.valid).toHaveLength(1);
      const { row, warnings } = result.valid[0]!;
      expect(warnings).toEqual([]);
      expect(row).toEqual({
        rowNumber: 2,
        coolfireUploadMarker: "X",
        uploadedToCoolfire: true,
        type: "Food",
        isCancelled: false,
        invoiceNumber: "INV-1001",
        date: "2026-06-29",
        vendor: "Test Kitchen - DAL",
        routeOrder: "GRPDAL0001-TEST_KITCHEN",
        routeGroup: "GRPDAL0001",
        pickupTime: "08:00",
        arrivalTime: "08:45",
        completeTime: "09:00",
        headcount: 19,
        foodCost: 412.5,
        timestamps: {
          enrouteVendor: "07:27",
          arrivedVendor: "07:56",
          leftVendor: "08:05",
          arrivedClient: "08:47",
          completionTime: "08:52",
        },
        driverName: "Test Driver One",
        backupDriver: null,
        helpdeskAgent: "Agent A",
        vendorPickupLocation: "TEST_KITCHEN",
        vendorAddress: "100 Main St, Dallas, TX 75201",
        client: "Example Corp",
        clientAddress: "200 Elm St, Dallas, TX 75202",
        specialNotes: "Call on arrival",
        parkingInstructions: "Loading dock in back",
        adminNotes: null,
        contact: {
          contactPhone: "5555550100",
          primaryContact: "Pat Example",
          contactEmail: "pat@example.com",
          locationPhone: null,
          generalEmail: null,
          website: null,
        },
        coolfireSuccessId: "11111111-2222-4333-8444-555555555555",
        stopNumber: null,
        mileageToNextStop: null,
        financials: {
          driverMaxPayPerDrop: 27.38,
          driverBasePayPerDrop: 15,
          totalMileage: 13.4,
          mileageRate: 0.7,
          totalMileagePay: 2.38,
          driverTotalBasePay: 27.38,
          bonusVariance: null,
          readySetFee: 35,
          readySetAddonFee: 8.5,
          readySetMileageRate: 2.5,
          readySetTotalFee: 43.5,
          toll: null,
          tip: 1250,
          driverBonusPay: 10,
          adjustment: -5,
          totalDriverPay: 27.38,
        },
      });
    });

    it("accepts the date and time spellings seen in the real exports", () => {
      const result = parseOne({
        Date: "01/05/26",
        "Pick Up": "10:30: AM", // stray colon, real export
        Arrival: "12:45 PM",
        Complete: "1:15PM",
      });

      const row = result.valid[0]!.row;
      expect(row.date).toBe("2026-01-05");
      expect(row.pickupTime).toBe("10:30");
      expect(row.arrivalTime).toBe("12:45");
      expect(row.completeTime).toBe("13:15");
    });

    it("treats 12 AM as midnight and accepts a four-digit year", () => {
      const row = parseOne({ Date: "12/31/2026", "Pick Up": "12:05 AM" })
        .valid[0]!.row;
      expect(row.date).toBe("2026-12-31");
      expect(row.pickupTime).toBe("00:05");
    });

    it("trims the vendor (real exports carry trailing spaces)", () => {
      const row = parseOne({ Vendor: "CaterValley " }).valid[0]!.row;
      expect(row.vendor).toBe("CaterValley");
    });

    it("flags Cancelled rows instead of dropping them", () => {
      const row = parseOne({ Type: "Cancelled" }).valid[0]!.row;
      expect(row.isCancelled).toBe(true);
    });

    it("leaves routeGroup null when Route/Order has no GRP prefix", () => {
      const row = parseOne({ "Route/Order": "Direct" }).valid[0]!.row;
      expect(row.routeGroup).toBeNull();
    });

    it("treats an empty Coolfire Upload cell as not uploaded", () => {
      const row = parseOne({ "Coolfire Upload": "" }).valid[0]!.row;
      expect(row.coolfireUploadMarker).toBeNull();
      expect(row.uploadedToCoolfire).toBe(false);
    });
  });

  describe("missing required fields", () => {
    it.each([
      ["Date", "date"],
      ["Vendor", "vendor"],
      ["Route/Order", "routeOrder"],
      ["Pick Up", "pickupTime"],
      ["Vendor Address", "vendorAddress"],
      ["Client Address", "clientAddress"],
    ])("rejects the row when %s is blank", (header, field) => {
      const result = parseOne({ [header]: "  " });

      expect(result.valid).toEqual([]);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0]!.rowNumber).toBe(2);
      expect(result.invalid[0]!.errors).toEqual([
        expect.objectContaining({ field, header, message: "Required" }),
      ]);
    });

    it("reports every error on the row, not just the first", () => {
      const result = parseOne({ Date: "", "Client Address": "" });
      expect(result.invalid[0]!.errors.map((e) => e.field)).toEqual([
        "date",
        "clientAddress",
      ]);
    });
  });

  describe("bad dates and times", () => {
    it.each(["2026-06-29", "13/1/26", "2/30/26", "6/29", "tomorrow"])(
      "rejects date %p",
      (value) => {
        const result = parseOne({ Date: value });
        expect(result.invalid[0]!.errors).toEqual([
          expect.objectContaining({
            field: "date",
            value,
            message: expect.stringContaining("date"),
          }),
        ]);
      },
    );

    it.each(["13:00 PM", "8:75 AM", "noon", "25:00"])(
      "rejects pickup time %p",
      (value) => {
        const result = parseOne({ "Pick Up": value });
        expect(result.invalid[0]!.errors).toEqual([
          expect.objectContaining({ field: "pickupTime", value }),
        ]);
      },
    );

    it("accepts a 24-hour pickup time", () => {
      expect(parseOne({ "Pick Up": "14:30" }).valid[0]!.row.pickupTime).toBe(
        "14:30",
      );
    });

    it("nulls a bad optional time with a warning instead of rejecting the row", () => {
      const result = parseOne({ "Arrived Client": "??" });

      expect(result.invalid).toEqual([]);
      const { row, warnings } = result.valid[0]!;
      expect(row.timestamps.arrivedClient).toBeNull();
      expect(warnings).toEqual([
        expect.objectContaining({
          field: "timestamps.arrivedClient",
          header: "Arrived Client",
          value: "??",
        }),
      ]);
    });
  });

  describe("bad optional values", () => {
    it.each([
      ["Headcount / Total Drops", "lots", "headcount"],
      ["Tip", "$abc", "financials.tip"],
      ["Coolfire Success ID", "not-a-uuid", "coolfireSuccessId"],
      ["Stop #", "first", "stopNumber"],
    ])("warns and nulls %s = %p", (header, value, field) => {
      const result = parseOne({ [header]: value });
      expect(result.invalid).toEqual([]);
      expect(result.valid[0]!.warnings).toEqual([
        expect.objectContaining({ field, header, value }),
      ]);
    });
  });

  describe("multi-stop routes", () => {
    it("groups pickup legs that share a GRP prefix and reads Stop #", () => {
      const result = parseMasterSheetRows([
        REAL_MASTER_SHEET_HEADERS,
        makeRow({ "Route/Order": "GRPDAL0002-KITCHEN_A", "Stop #": "1" }),
        makeRow({
          "Route/Order": "GRPDAL0002-KITCHEN_B",
          "Stop #": "2",
          "Mileage to Next Stop": "3.2",
        }),
      ]);
      if (!result.ok) throw new Error("expected ok");

      const rows = result.valid.map((v) => v.row);
      expect(rows.map((r) => r.routeGroup)).toEqual([
        "GRPDAL0002",
        "GRPDAL0002",
      ]);
      expect(rows.map((r) => r.stopNumber)).toEqual([1, 2]);
      expect(rows[1]!.mileageToNextStop).toBe(3.2);
      expect(rows.map((r) => r.rowNumber)).toEqual([2, 3]);
    });
  });

  describe("sheet-level handling", () => {
    it("returns ok:false listing missing required headers instead of throwing", () => {
      const headers = REAL_MASTER_SHEET_HEADERS.filter(
        (h) => h !== "Pick Up" && h !== "Client Address",
      );
      const result = parseMasterSheetRows([headers, makeRow({}, headers)]);

      expect(result).toEqual({
        ok: false,
        missingRequiredHeaders: ["Pick Up", "Client Address"],
      });
    });

    it("returns ok:false for an empty sheet", () => {
      expect(parseMasterSheetRows([])).toEqual({
        ok: false,
        missingRequiredHeaders: expect.arrayContaining(["Date"]),
      });
    });

    it("resolves columns by header, not position", () => {
      const headers = [...REAL_MASTER_SHEET_HEADERS].reverse();
      const result = parseMasterSheetRows([headers, makeRow({}, headers)]);
      if (!result.ok) throw new Error("expected ok");
      expect(result.valid[0]!.row.pickupTime).toBe("08:00");
      expect(result.valid[0]!.row.clientAddress).toBe(
        "200 Elm St, Dallas, TX 75202",
      );
    });

    it("reports missing optional headers and nulls their fields", () => {
      // One real export has a blank header where " Enroute Vendor" sits.
      const headers = REAL_MASTER_SHEET_HEADERS.map((h) =>
        h === " Enroute Vendor" ? " " : h,
      );
      const result = parseMasterSheetRows([headers, makeRow({}, headers)]);
      if (!result.ok) throw new Error("expected ok");

      expect(result.missingOptionalHeaders).toEqual(["Enroute Vendor"]);
      expect(result.valid[0]!.row.timestamps.enrouteVendor).toBeNull();
      expect(result.valid[0]!.warnings).toEqual([]);
    });

    it("skips fully blank rows and counts them", () => {
      const result = parseMasterSheetRows([
        REAL_MASTER_SHEET_HEADERS,
        makeRow(),
        [],
        REAL_MASTER_SHEET_HEADERS.map(() => "  "),
        makeRow({ Date: "bad" }),
      ]);
      if (!result.ok) throw new Error("expected ok");

      expect(result.blankRowCount).toBe(2);
      expect(result.valid.map((v) => v.rowNumber)).toEqual([2]);
      expect(result.invalid.map((v) => v.rowNumber)).toEqual([5]);
    });

    it("handles short rows (Sheets API drops trailing empty cells)", () => {
      const full = makeRow();
      const lastRequired = REAL_MASTER_SHEET_HEADERS.indexOf("Client Address");
      const result = parseMasterSheetRows([
        REAL_MASTER_SHEET_HEADERS,
        full.slice(0, lastRequired + 1),
      ]);
      if (!result.ok) throw new Error("expected ok");
      expect(result.invalid).toEqual([]);
      expect(result.valid[0]!.row.coolfireSuccessId).toBeNull();
    });
  });
});
