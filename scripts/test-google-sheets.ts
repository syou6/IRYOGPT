/**
 * Google Sheets API 接続テスト
 *
 * 使い方:
 * 1. テスト用のスプレッドシートを作成
 * 2. サービスアカウントのメールアドレスを編集者として共有
 *    (webgpt-sheets@webgpt-medical.iam.gserviceaccount.com)
 * 3. スプレッドシートIDを引数に渡して実行:
 *    npm run test:sheets -- <spreadsheet_id>
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getSpreadsheetInfo, readSheet, appendToSheet } from '../utils/google-sheets.js';

async function main() {
  const spreadsheetId = process.argv[2];

  if (!spreadsheetId) {
    console.error('使い方: npm run test:sheets -- <spreadsheet_id>');
    console.error('');
    console.error('スプレッドシートIDの取得方法:');
    console.error('URLの https://docs.google.com/spreadsheets/d/<ここがID>/edit の部分');
    process.exit(1);
  }

  console.log('=== Google Sheets API 接続テスト ===\n');

  try {
    // 1. スプレッドシート情報を取得
    console.log('1. スプレッドシート情報を取得中...');
    const info = await getSpreadsheetInfo(spreadsheetId);
    console.log(`   タイトル: ${info.properties?.title}`);
    console.log(`   シート数: ${info.sheets?.length}`);
    info.sheets?.forEach((sheet, i) => {
      console.log(`   - シート${i + 1}: ${sheet.properties?.title}`);
    });
    console.log('   ✅ 成功!\n');

    // 2. データを読み取り
    console.log('2. シート1のデータを読み取り中...');
    const data = await readSheet(spreadsheetId, 'シート1!A1:H10');
    if (data.length > 0) {
      console.log(`   行数: ${data.length}`);
      console.log('   先頭行:', data[0]);
    } else {
      console.log('   (データなし)');
    }
    console.log('   ✅ 成功!\n');

    // 3. テストデータを追加
    console.log('3. テストデータを追加中...');
    const testData = [
      ['2025/1/24', '10:00', 'テスト太郎', '090-0000-0000', 'test@example.com', 'API接続テスト', '確定', 'Bot'],
    ];
    await appendToSheet(spreadsheetId, 'シート1!A:H', testData);
    console.log('   追加データ:', testData[0]);
    console.log('   ✅ 成功!\n');

    console.log('=== 全テスト完了! Google Sheets API 正常に動作しています ===');

  } catch (error: any) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error.message);

    if (error.message.includes('not found')) {
      console.error('\n→ スプレッドシートIDが間違っているか、共有設定がされていません');
    }
    if (error.message.includes('permission')) {
      console.error('\n→ サービスアカウントにスプレッドシートが共有されていません');
      console.error('   以下のメールアドレスを編集者として追加してください:');
      console.error('   webgpt-sheets@webgpt-medical.iam.gserviceaccount.com');
    }
    if (error.message.includes('API has not been used') || error.message.includes('disabled')) {
      console.error('\n→ Google Sheets API が有効になっていません');
      console.error('   Google Cloud Console で有効化してください');
    }

    process.exit(1);
  }
}

main();
