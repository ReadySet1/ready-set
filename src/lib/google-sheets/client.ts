import { google, type sheets_v4 } from "googleapis";

let readClient: sheets_v4.Sheets | null = null;
let writeClient: sheets_v4.Sheets | null = null;

function getAuthConfig() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing Google Sheets configuration. Set GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY.",
    );
  }

  return { clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}

function getSheetsClient(): sheets_v4.Sheets {
  if (readClient) return readClient;

  const { clientEmail, privateKey } = getAuthConfig();
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  readClient = google.sheets({ version: "v4", auth });
  return readClient;
}

function getWriteSheetsClient(): sheets_v4.Sheets {
  if (writeClient) return writeClient;

  const { clientEmail, privateKey } = getAuthConfig();
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  writeClient = google.sheets({ version: "v4", auth });
  return writeClient;
}

function getSpreadsheetId(): string {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SHEET_ID environment variable.");
  }
  return spreadsheetId;
}

export async function getSheetData(
  sheetName: string = "Drives - Coolfire",
  range?: string,
): Promise<string[][]> {
  const spreadsheetId = getSpreadsheetId();
  const client = getSheetsClient();
  const fullRange = range ? `'${sheetName}'!${range}` : `'${sheetName}'`;

  const response = await client.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
  });

  return (response.data.values as string[][]) ?? [];
}

export interface SheetUpdateRange {
  range: string;
  values: (string | number)[][];
}

export async function updateSheetData(
  sheetName: string,
  range: string,
  values: (string | number)[][],
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  const client = getWriteSheetsClient();
  const fullRange = `'${sheetName}'!${range}`;

  await client.spreadsheets.values.update({
    spreadsheetId,
    range: fullRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function batchUpdateSheetData(
  sheetName: string,
  updates: SheetUpdateRange[],
): Promise<void> {
  if (updates.length === 0) return;

  const spreadsheetId = getSpreadsheetId();
  const client = getWriteSheetsClient();

  const data = updates.map((u) => ({
    range: `'${sheetName}'!${u.range}`,
    values: u.values,
  }));

  await client.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}
