import { google } from 'googleapis';

/**
 * Google Sheets API クライアントを取得
 */
export function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * スプレッドシートからデータを読み取る
 */
export async function readSheet(spreadsheetId: string, range: string) {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values || [];
}

/**
 * スプレッドシートにデータを追加（最終行に追加）
 */
export async function appendToSheet(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
) {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
  return response.data;
}

/**
 * スプレッドシートの特定セルを更新
 */
export async function updateSheet(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
) {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
  return response.data;
}

/**
 * スプレッドシートの情報を取得（シート一覧など）
 */
export async function getSpreadsheetInfo(spreadsheetId: string) {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
  });
  return response.data;
}
