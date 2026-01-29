/**
 * 医療予約対応用のチャットチェーン
 * OpenAI Function Calling を使用して予約処理を行う
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  getMedicalSystemPromptWithSettings,
  APPOINTMENT_TOOLS,
} from './prompts/medical-appointment';
import {
  getAvailableSlots,
  createAppointment,
  cancelAppointment,
  getClinicSettings,
  getAppointmentsByDate,
  TimeSlot,
} from './appointment';
import { sendAppointmentConfirmationEmail } from './email';
import {
  validateDateFormat,
  validateTimeFormat,
  validatePhone,
  validateEmail,
  validatePatientName,
  validateSymptom,
} from './validators';
import { sanitizeForSheet, normalizeOptionalValue } from './sanitizers';
import { DAY_NAMES } from './constants';

export interface AppointmentChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface AppointmentChatResult {
  message: string;
  toolCalls?: any[];
  appointmentCreated?: boolean;
}

/**
 * 予約対応チャットを実行
 */
export async function runAppointmentChat(
  spreadsheetId: string,
  messages: AppointmentChatMessage[],
  onToken?: (token: string) => void
): Promise<AppointmentChatResult> {
  // 最初に設定を取得してプロンプトに埋め込む（AIがget_clinic_infoを呼ばなくても設定を知れるように）
  const settings = await getClinicSettings(spreadsheetId);

  // システムプロンプトを追加（今日の日付情報 + 医院設定を含む）
  const fullMessages = [
    { role: 'system' as const, content: getMedicalSystemPromptWithSettings(settings) },
    ...messages,
  ];

  // 最初の呼び出し（ツール判定用、ストリーミングなし）
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    streaming: false,
  });

  let response = await model.invoke(fullMessages as any, {
    tools: APPOINTMENT_TOOLS,
    tool_choice: 'required',
  });

  // ツール呼び出しを処理
  if (!response.tool_calls || response.tool_calls.length === 0) {
    console.error('[Appointment] No tool calls despite tool_choice=required');
    return {
      message: 'ご質問にお答えできませんでした。もう一度お試しください。',
    };
  }

  // send_message と他のツールを分離
  const sendMessageCall = response.tool_calls.find((tc: any) => tc.name === 'send_message');
  const otherToolCalls = response.tool_calls.filter((tc: any) => tc.name !== 'send_message');

  // 他のツールがある場合 → 他のツールを優先実行
  if (otherToolCalls.length > 0) {
    const toolResults: AppointmentChatMessage[] = [];
    let appointmentCreated = false;

    for (const toolCall of otherToolCalls) {
      const result = await executeToolCall(spreadsheetId, toolCall);

      if (toolCall.name === 'create_appointment' && result.startsWith('予約が完了しました')) {
        appointmentCreated = true;
      }

      toolResults.push({
        role: 'tool',
        content: result,
        tool_call_id: toolCall.id,
      });
    }

    // send_message が同時に呼ばれていた場合、ダミーの結果を返す（APIエラー防止）
    if (sendMessageCall) {
      toolResults.push({
        role: 'tool',
        content: '（メッセージ送信はスキップ。ツール結果を基に応答してください）',
        tool_call_id: sendMessageCall.id,
      });
    }

    const newMessages = [
      ...fullMessages,
      {
        role: 'assistant' as const,
        content: '',
        tool_calls: response.tool_calls,
      },
      ...toolResults,
      {
        role: 'system' as const,
        content: '【重要】ツールの実行結果が上記にあります。「お待ちください」「確認します」は絶対に言わず、結果を即座にユーザーに伝えてください。',
      },
    ];

    const streamingModel = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      streaming: Boolean(onToken),
    });

    const finalResponse = await streamingModel.invoke(newMessages as any, {
      callbacks: onToken
        ? [
            {
              handleLLMNewToken: (token: string) => {
                onToken(token);
              },
            },
          ]
        : undefined,
    });

    return {
      message: finalResponse.content as string,
      toolCalls: otherToolCalls,
      appointmentCreated,
    };
  }

  // send_message のみの場合 → メッセージをそのまま返す（2回目のLLM呼び出し不要）
  const messageText = sendMessageCall!.args?.message || '';
  if (onToken) {
    for (const char of messageText) {
      onToken(char);
    }
  }

  return {
    message: messageText,
  };
}

/**
 * ツール呼び出しを実行
 */
async function executeToolCall(
  spreadsheetId: string,
  toolCall: { name: string; args: any }
): Promise<string> {
  const { name, args } = toolCall;

  switch (name) {
    case 'get_date_info': {
      // 日付をパースして曜日を返す
      try {
        const [year, month, day] = args.date.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        const dayOfWeek = DAY_NAMES[date.getDay()];

        // 今日との差分も計算
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let relativeInfo = '';
        if (diffDays === 0) relativeInfo = '（今日）';
        else if (diffDays === 1) relativeInfo = '（明日）';
        else if (diffDays === 2) relativeInfo = '（明後日）';
        else if (diffDays > 0) relativeInfo = `（${diffDays}日後）`;
        else relativeInfo = '（過去の日付）';

        return `${args.date}は${dayOfWeek}曜日です${relativeInfo}`;
      } catch (e) {
        return `日付の形式が正しくありません。YYYY/M/D形式で指定してください（例: 2026/1/27）`;
      }
    }

    case 'get_available_slots': {
      // 日付バリデーション
      const dateValidation = validateDateFormat(args.date);
      if (!dateValidation.valid) {
        return dateValidation.error || '日付の形式が正しくありません。';
      }

      const settings = await getClinicSettings(spreadsheetId);
      const [year, month, day] = dateValidation.normalized!.split('/').map(Number);
      const targetDate = new Date(year, month - 1, day);
      targetDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 過去の日付チェック
      if (targetDate < today) {
        return `${args.date}は過去の日付です。本日以降の日付をお選びください。`;
      }

      // 予約可能日数チェック
      const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > settings.maxAdvanceDays) {
        const maxDate = new Date(today.getTime() + settings.maxAdvanceDays * 24 * 60 * 60 * 1000);
        const maxDateStr = `${maxDate.getFullYear()}/${maxDate.getMonth() + 1}/${maxDate.getDate()}（${DAY_NAMES[maxDate.getDay()]}）`;
        return `${args.date}は予約可能期間外です。${settings.maxAdvanceDays}日先（${maxDateStr}）までの日付をお選びください。`;
      }

      const slots = await getAvailableSlots(spreadsheetId, args.date);
      console.log(`[Tool] get_available_slots for ${args.date}:`, JSON.stringify(slots, null, 2));

      if (slots.length === 0) {
        return `【${args.date}】休診日のため予約枠がありません。別の日をお選びください。`;
      }
      const availableSlots = slots.filter((s: TimeSlot) => s.available);
      const bookedSlots = slots.filter((s: TimeSlot) => !s.available);

      if (availableSlots.length === 0) {
        return `【${args.date}】全ての枠が予約済みです。別の日をお選びください。`;
      }

      // 残り枠数を含めた情報を返す（例: "9:00(残2)", "10:00(残1)"）
      const timeListWithSlots = availableSlots.map((s: TimeSlot) =>
        s.remainingSlots > 1 ? `${s.time}(残${s.remainingSlots})` : s.time
      ).join(', ');

      // 予約済みの枠がある場合は明示
      if (bookedSlots.length > 0) {
        const bookedTimeList = bookedSlots.map((s: TimeSlot) => s.time).join(', ');
        return `【${args.date}の予約状況】\n空き枠: ${timeListWithSlots}\n予約済み: ${bookedTimeList}`;
      }
      return `【${args.date}の予約状況】\n空き枠: ${timeListWithSlots}\n予約済み: なし`;
    }

    case 'create_appointment': {
      // 設定を取得してバリデーション
      const settings = await getClinicSettings(spreadsheetId);

      // 日付バリデーション
      const dateVal = validateDateFormat(args.date);
      if (!dateVal.valid) {
        return dateVal.error || '日付の形式が正しくありません。';
      }

      // 時刻バリデーション
      const timeVal = validateTimeFormat(args.time);
      if (!timeVal.valid) {
        return timeVal.error || '時刻の形式が正しくありません。';
      }

      // 電話番号バリデーション（国際形式対応）
      const phoneVal = validatePhone(args.patient_phone);
      if (!phoneVal.valid) {
        return phoneVal.error || '電話番号の形式が正しくありません。';
      }
      const phoneDigits = phoneVal.normalized!;

      // 患者名バリデーション
      const nameVal = validatePatientName(args.patient_name);
      if (!nameVal.valid) {
        return nameVal.error || 'お名前を入力してください。';
      }

      // メールバリデーション（任意）
      if (args.patient_email) {
        const emailVal = validateEmail(args.patient_email);
        if (!emailVal.valid) {
          return emailVal.error || 'メールアドレスの形式が正しくありません。';
        }
      }

      // 症状バリデーション（任意）
      if (args.symptom) {
        const symptomVal = validateSymptom(args.symptom);
        if (!symptomVal.valid) {
          return symptomVal.error || 'ご来院の目的が長すぎます。';
        }
      }

      // 同一患者（電話番号）の同日重複チェック
      const existingAppointments = await getAppointmentsByDate(spreadsheetId, dateVal.normalized!);
      const duplicateAppointment = existingAppointments.find(
        (apt) => apt.patientPhone.replace(/[-\s]/g, '') === phoneDigits
      );
      if (duplicateAppointment) {
        return `同じ電話番号（${args.patient_phone}）で${args.date}に既に${duplicateAppointment.time}のご予約があります。別の日程をご希望ですか？`;
      }

      // 担当医選択が有効なのに doctor が未入力ならエラー
      const normalizedDoctor = normalizeOptionalValue(args.doctor || '');
      if (settings.useDoctorSelection && settings.doctorList.length > 0 && !args.doctor) {
        return `担当医の確認が必要です。「${settings.doctorList.join('、')}」の中からご希望を確認するか、特にご希望がなければ「なし」と入力してください。`;
      }

      // 診察券番号が有効なのに未入力ならエラー
      const normalizedCardNumber = normalizeOptionalValue(args.patient_card_number || '');
      if (settings.usePatientCardNumber && !args.patient_card_number) {
        return `診察券番号の確認が必要です。「診察券番号をお持ちでしたらお伝えください。初診の方や番号がわからない場合は『なし』で大丈夫です」と確認してください。`;
      }

      // サニタイズしてから保存
      const result = await createAppointment(spreadsheetId, {
        date: dateVal.normalized!,
        time: timeVal.normalized!,
        patientName: sanitizeForSheet(nameVal.normalized!),
        patientPhone: phoneDigits,
        patientEmail: args.patient_email ? sanitizeForSheet(args.patient_email) : '',
        patientCardNumber: normalizedCardNumber,
        doctor: normalizedDoctor,
        symptom: args.symptom ? sanitizeForSheet(args.symptom) : '',
        bookedVia: 'ChatBot',
      });

      if (result.success) {
        // メール送信（患者にメールアドレスがある場合）
        let emailSent = false;
        if (args.patient_email) {
          try {
            await sendAppointmentConfirmationEmail({
              patientName: args.patient_name,
              patientEmail: args.patient_email,
              date: args.date,
              time: args.time,
              clinicName: settings.clinicName,
              symptom: args.symptom,
            });
            emailSent = true;
          } catch (err) {
            console.error('[Appointment] Email send error:', err);
          }
        }
        // 結果メッセージを組み立て
        let confirmMsg = `予約が完了しました。日時: ${args.date} ${args.time}、患者名: ${args.patient_name}`;
        if (normalizedDoctor) {
          confirmMsg += `、担当医: ${normalizedDoctor}`;
        }
        if (args.patient_email && !emailSent) {
          confirmMsg += `（確認メールの送信に失敗しました）`;
        }
        return confirmMsg;
      } else {
        return `予約に失敗しました: ${result.message}`;
      }
    }

    case 'get_clinic_info': {
      const settings = await getClinicSettings(spreadsheetId);
      let info = `医院名: ${settings.clinicName}
診療時間: ${settings.startTime}〜${settings.endTime}
昼休み: ${settings.breakStart}〜${settings.breakEnd}
1枠: ${settings.slotDuration}分
休診曜日: ${settings.closedDays.join('、')}`;

      // 担当医リストがある場合は追加
      if (settings.useDoctorSelection && settings.doctorList.length > 0) {
        info += `\n担当医: ${settings.doctorList.join('、')}`;
      }
      // 診察券番号使用の案内
      if (settings.usePatientCardNumber) {
        info += `\n※再診の方は診察券番号をお伝えください`;
      }
      return info;
    }

    case 'cancel_appointment': {
      // 日付バリデーション
      const cancelDateVal = validateDateFormat(args.date);
      if (!cancelDateVal.valid) {
        return cancelDateVal.error || '日付の形式が正しくありません。';
      }

      // 時刻バリデーション
      const cancelTimeVal = validateTimeFormat(args.time);
      if (!cancelTimeVal.valid) {
        return cancelTimeVal.error || '時刻の形式が正しくありません。';
      }

      // 電話番号バリデーション（国際形式対応）
      const cancelPhoneVal = validatePhone(args.patient_phone);
      if (!cancelPhoneVal.valid) {
        return `ご予約時にお伝えいただいた電話番号を再度ご確認ください。${cancelPhoneVal.error || ''}`;
      }
      const phoneDigits = cancelPhoneVal.normalized!;

      // 予約を検索して本人確認
      const appointments = await getAppointmentsByDate(spreadsheetId, cancelDateVal.normalized!);
      const targetAppointment = appointments.find(
        (apt) => apt.time === cancelTimeVal.normalized && apt.patientPhone.replace(/[-\s]/g, '') === phoneDigits
      );

      if (!targetAppointment) {
        return `${args.date} ${args.time}のご予約が見つかりません。日時と電話番号をご確認ください。`;
      }

      // キャンセル実行
      const result = await cancelAppointment(spreadsheetId, cancelDateVal.normalized!, cancelTimeVal.normalized!);
      if (result.success) {
        return `${args.date} ${args.time}のご予約をキャンセルしました。またのご利用をお待ちしております。`;
      } else {
        return `キャンセルに失敗しました: ${result.message}`;
      }
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

/**
 * シンプルな予約チャットのテスト用関数
 */
export async function testAppointmentChat(
  spreadsheetId: string,
  userMessage: string,
  chatHistory: AppointmentChatMessage[] = []
): Promise<string> {
  const messages: AppointmentChatMessage[] = [
    ...chatHistory,
    { role: 'user', content: userMessage },
  ];

  const result = await runAppointmentChat(spreadsheetId, messages);
  return result.message;
}
