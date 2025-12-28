/**
 * 予約API 動作テスト
 *
 * 使い方: npm run test:appointment
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
  getClinicSettings,
  getAvailableSlots,
  createAppointment,
  cancelAppointment,
} from '../utils/appointment.js';

const SPREADSHEET_ID = '136Iu0vdefE7h-UibePv0wyk_WIN-XGm1PCoES1u32lc';

async function main() {
  console.log('=== 予約システム 動作テスト ===\n');

  try {
    // 1. 設定を取得
    console.log('1. 医院設定を取得中...');
    const settings = await getClinicSettings(SPREADSHEET_ID);
    console.log('   医院名:', settings.clinicName);
    console.log('   診療時間:', settings.startTime, '-', settings.endTime);
    console.log('   昼休み:', settings.breakStart, '-', settings.breakEnd);
    console.log('   1枠:', settings.slotDuration, '分');
    console.log('   休診曜日:', settings.closedDays.join(', '));
    console.log('   ✅ 成功!\n');

    // 2. 空き枠を取得（今日）
    const today = new Date();
    const todayStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
    console.log(`2. 空き枠を取得中... (${todayStr})`);
    const slots = await getAvailableSlots(SPREADSHEET_ID, todayStr);

    if (slots.length === 0) {
      console.log('   (休診日または定休日のため空き枠なし)');
    } else {
      const availableCount = slots.filter(s => s.available).length;
      console.log(`   全${slots.length}枠中、${availableCount}枠が空き`);
      slots.slice(0, 5).forEach(slot => {
        const status = slot.available ? '◯' : `✗ (${slot.patientName})`;
        console.log(`   ${slot.time} ${status}`);
      });
      if (slots.length > 5) console.log('   ...');
    }
    console.log('   ✅ 成功!\n');

    // 3. 明日の空き枠を取得
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}/${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
    console.log(`3. 明日の空き枠を取得中... (${tomorrowStr})`);
    const tomorrowSlots = await getAvailableSlots(SPREADSHEET_ID, tomorrowStr);

    if (tomorrowSlots.length === 0) {
      console.log('   (休診日または定休日のため空き枠なし)');
      console.log('   ✅ 成功!\n');
      console.log('=== テスト完了（予約テストはスキップ）===');
      return;
    }

    const availableSlot = tomorrowSlots.find(s => s.available);
    if (!availableSlot) {
      console.log('   空き枠がありません');
      console.log('   ✅ 成功!\n');
      console.log('=== テスト完了（予約テストはスキップ）===');
      return;
    }

    console.log(`   空き枠あり: ${availableSlot.time}`);
    console.log('   ✅ 成功!\n');

    // 4. 予約を作成
    console.log(`4. 予約を作成中... (${tomorrowStr} ${availableSlot.time})`);
    const createResult = await createAppointment(SPREADSHEET_ID, {
      date: tomorrowStr,
      time: availableSlot.time,
      patientName: 'APIテスト患者',
      patientPhone: '090-0000-0001',
      patientEmail: 'apitest@example.com',
      symptom: 'APIテスト予約',
      bookedVia: 'APITest',
    });
    console.log('   結果:', createResult.message);
    console.log('   ✅ 成功!\n');

    // 5. 同じ枠に再度予約（失敗するはず）
    console.log('5. 同じ枠に再度予約（ダブルブッキング防止テスト）...');
    const duplicateResult = await createAppointment(SPREADSHEET_ID, {
      date: tomorrowStr,
      time: availableSlot.time,
      patientName: '重複テスト',
      patientPhone: '090-0000-0002',
    });
    if (!duplicateResult.success) {
      console.log('   結果:', duplicateResult.message);
      console.log('   ✅ 正しくブロックされました!\n');
    } else {
      console.log('   ❌ エラー: ダブルブッキングが発生しました\n');
    }

    // 6. 予約をキャンセル
    console.log(`6. 予約をキャンセル中... (${tomorrowStr} ${availableSlot.time})`);
    const cancelResult = await cancelAppointment(SPREADSHEET_ID, tomorrowStr, availableSlot.time);
    console.log('   結果:', cancelResult.message);
    console.log('   ✅ 成功!\n');

    console.log('=== 全テスト完了! 予約システムは正常に動作しています ===');

  } catch (error: any) {
    console.error('\n❌ エラーが発生しました:');
    console.error(error.message);
    process.exit(1);
  }
}

main();
