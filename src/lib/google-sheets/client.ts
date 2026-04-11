import { google, type sheets_v4 } from "googleapis";

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) {
    return sheetsClient;
  }

  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing Google Sheets configuration. Set GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY.",
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

export async function getSheetData(
  sheetName: string = "Drives - Coolfire",
  range?: string,
): Promise<string[][]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SHEET_ID;

  if (!spreadsheetId) {
    throw new Error(
      "Missing GOOGLE_SHEETS_SHEET_ID environment variable.",
    );
  }

  const client = getSheetsClient();
  const fullRange = range ? `'${sheetName}'!${range}` : `'${sheetName}'`;

  const response = await client.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
  });

  return (response.data.values as string[][]) ?? [];
}
