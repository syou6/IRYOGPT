/**
 * 予約チャット 動作テスト
 *
 * 使い方: npm run test:chat
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { runAppointmentChat, AppointmentChatMessage } from '../utils/makechain-appointment.js';

const SPREADSHEET_ID = '136Iu0vdefE7h-UibePv0wyk_WIN-XGm1PCoES1u32lc';

async function simulateConversation() {
  console.log('=== 予約チャット シミュレーション ===\n');

  const messages: AppointmentChatMessage[] = [];

  // 会話をシミュレート
  const userMessages = [
    '予約したいのですが',
    '明日の午前中で',
    '10時でお願いします',
    'チャットテスト太郎です',
    '090-9999-8888',
    '定期検診です',
  ];

  for (const userMessage of userMessages) {
    console.log(`👤 患者: ${userMessage}`);
    messages.push({ role: 'user', content: userMessage });

    try {
      let responseText = '';
      const result = await runAppointmentChat(SPREADSHEET_ID, messages, (token) => {
        process.stdout.write(token);
        responseText += token;
      });

      // ストリーミングで出力されなかった部分があれば出力
      if (result.message && result.message !== responseText) {
        console.log(result.message);
        responseText = result.message;
      }

      console.log('\n');

      // アシスタントの応答を履歴に追加
      messages.push({ role: 'assistant', content: responseText || result.message });

      if (result.appointmentCreated) {
        console.log('✅ 予約が作成されました！\n');
        break;
      }

      // 次のメッセージまで少し待つ
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error('\n❌ エラー:', error.message);
      break;
    }
  }

  console.log('=== シミュレーション完了 ===');
}

async function singleQuery(query: string) {
  console.log(`👤 患者: ${query}\n`);
  console.log('🤖 AI: ');

  try {
    let streamed = false;
    const result = await runAppointmentChat(
      SPREADSHEET_ID,
      [{ role: 'user', content: query }],
      (token) => {
        process.stdout.write(token);
        streamed = true;
      }
    );

    // ストリーミングされなかった場合のみ結果を出力
    if (!streamed && result.message) {
      console.log(result.message);
    }
    console.log('\n');

    if (result.toolCalls) {
      console.log('📞 ツール呼び出し:', result.toolCalls.map(t => t.name).join(', '));
    }
  } catch (error: any) {
    console.error('\n❌ エラー:', error.message);
  }
}

async function main() {
  const mode = process.argv[2] || 'single';

  if (mode === 'simulate') {
    await simulateConversation();
  } else {
    // 単一クエリのテスト
    const query = process.argv.slice(2).join(' ') || '診療時間を教えてください';
    await singleQuery(query);
  }
}

main();
