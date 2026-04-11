export interface SheetDeliveryRow {
  coolfireUpload: string;
  type: string;
  date: string;
  parsedDate: Date;
  vendor: string;
  routeOrder: string;
  pickupTime: string;
  headcount: string;
  driverName: string;
  driverPhone: string;
  backupDriver: string;
  vendorPickupLocation: string;
  vendorAddress: string;
  client: string;
  clientAddress: string;
  specialNotes: string;
  driverPay: string;
}

export interface DriverGroup {
  driverName: string;
  phone: string;
  orders: SheetDeliveryRow[];
}

const REQUIRED_HEADERS = [
  "Date",
  "Driver",
  "Pick Up",
  "Vendor",
  "Route/Order",
  "Client",
  "Client Address",
  "Vendor Address",
];

function buildColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]?.trim();
    if (header) {
      map[header] = i;
    }
  }
  return map;
}

function getCell(
  row: string[],
  columnMap: Record<string, number>,
  header: string,
): string {
  const index = columnMap[header];
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

/**
 * Parse date from M/D/YY format (e.g., "3/1/26" -> March 1, 2026)
 */
function parseSheetDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0] ?? "", 10);
  const day = parseInt(parts[1] ?? "", 10);
  let year = parseInt(parts[2] ?? "", 10);

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

  // Handle 2-digit years: 26 -> 2026
  if (year < 100) {
    year += 2000;
  }

  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return null;

  return date;
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function parseDeliveryRows(rows: string[][]): SheetDeliveryRow[] {
  if (rows.length < 2) return [];

  const headers = rows[0];
  if (!headers) return [];

  const columnMap = buildColumnMap(headers);

  // Validate required headers exist
  const missingHeaders = REQUIRED_HEADERS.filter(
    (h) => columnMap[h] === undefined,
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `Missing required sheet headers: ${missingHeaders.join(", ")}`,
    );
  }

  const result: SheetDeliveryRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const driverName = getCell(row, columnMap, "Driver");
    if (!driverName) continue;

    const dateStr = getCell(row, columnMap, "Date");
    const parsedDate = parseSheetDate(dateStr);
    if (!parsedDate) continue;

    result.push({
      coolfireUpload: getCell(row, columnMap, "Coolfire Upload"),
      type: getCell(row, columnMap, "Type"),
      date: dateStr,
      parsedDate,
      vendor: getCell(row, columnMap, "Vendor"),
      routeOrder: getCell(row, columnMap, "Route/Order"),
      pickupTime: getCell(row, columnMap, "Pick Up"),
      headcount: getCell(row, columnMap, "Headcount / Total Drops"),
      driverName,
      driverPhone: getCell(row, columnMap, "Driver Phone"),
      backupDriver: getCell(row, columnMap, "Backup Driver"),
      vendorPickupLocation: getCell(row, columnMap, "Vendor Pick-Up Location"),
      vendorAddress: getCell(row, columnMap, "Vendor Address"),
      client: getCell(row, columnMap, "Client"),
      clientAddress: getCell(row, columnMap, "Client Address"),
      specialNotes: getCell(row, columnMap, "Special Notes"),
      driverPay: getCell(row, columnMap, "Driver Max Pay Per Drop"),
    });
  }

  return result;
}

export function filterByDate(
  rows: SheetDeliveryRow[],
  targetDate: Date,
): SheetDeliveryRow[] {
  return rows.filter((row) => isSameDate(row.parsedDate, targetDate));
}

export function groupByDriver(rows: SheetDeliveryRow[]): DriverGroup[] {
  const driverMap = new Map<string, DriverGroup>();

  for (const row of rows) {
    const key = row.driverName.toLowerCase();
    const existing = driverMap.get(key);

    if (existing) {
      existing.orders.push(row);
      // Use the first non-empty phone found
      if (!existing.phone && row.driverPhone) {
        existing.phone = row.driverPhone;
      }
    } else {
      driverMap.set(key, {
        driverName: row.driverName,
        phone: row.driverPhone,
        orders: [row],
      });
    }
  }

  return Array.from(driverMap.values());
}
