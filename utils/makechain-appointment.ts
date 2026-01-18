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
  getClinicSettings,
  TimeSlot,
} from './appointment';
import { sendAppointmentConfirmationEmail } from './email';

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

  const response = await model.invoke(fullMessages as any, {
    tools: APPOINTMENT_TOOLS,
    tool_choice: 'auto',
  });

  // ツール呼び出しがある場合
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolResults: AppointmentChatMessage[] = [];
    let appointmentCreated = false;

    for (const toolCall of response.tool_calls) {
      const result = await executeToolCall(spreadsheetId, toolCall);

      if (toolCall.name === 'create_appointment' && result.includes('完了')) {
        appointmentCreated = true;
      }

      toolResults.push({
        role: 'tool',
        content: result,
        tool_call_id: toolCall.id,
      });
    }

    // ツール結果を含めて再度実行（こちらはストリーミングあり）
    const newMessages = [
      ...fullMessages,
      {
        role: 'assistant' as const,
        content: response.content || '',
        tool_calls: response.tool_calls,
      },
      ...toolResults,
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
      toolCalls: response.tool_calls,
      appointmentCreated,
    };
  }

  // ツール呼び出しがない場合（通常の応答）
  // ストリーミングで再実行
  if (onToken) {
    const streamingModel = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      streaming: true,
    });

    const streamingResponse = await streamingModel.invoke(fullMessages as any, {
      callbacks: [
        {
          handleLLMNewToken: (token: string) => {
            onToken(token);
          },
        },
      ],
    });

    return {
      message: streamingResponse.content as string,
    };
  }

  return {
    message: response.content as string,
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
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      try {
        const [year, month, day] = args.date.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        const dayOfWeek = dayNames[date.getDay()];

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

      // 担当医選択が有効なのに doctor が未入力ならエラー
      if (settings.useDoctorSelection && settings.doctorList.length > 0 && !args.doctor) {
        return `担当医の確認が必要です。「${settings.doctorList.join('、')}」の中からご希望を確認するか、特にご希望がなければ「なし」と入力してください。`;
      }

      // 診察券番号が有効なのに未入力ならエラー
      if (settings.usePatientCardNumber && !args.patient_card_number) {
        return `診察券番号の確認が必要です。「診察券番号をお持ちでしたらお伝えください。初診の方や番号がわからない場合は『なし』で大丈夫です」と確認してください。`;
      }

      const result = await createAppointment(spreadsheetId, {
        date: args.date,
        time: args.time,
        patientName: args.patient_name,
        patientPhone: args.patient_phone,
        patientEmail: args.patient_email || '',
        patientCardNumber: args.patient_card_number || '',
        doctor: args.doctor || '',
        symptom: args.symptom || '',
        bookedVia: 'ChatBot',
      });

      if (result.success) {
        // メール送信（患者にメールアドレスがある場合）
        if (args.patient_email) {
          sendAppointmentConfirmationEmail({
            patientName: args.patient_name,
            patientEmail: args.patient_email,
            date: args.date,
            time: args.time,
            clinicName: settings.clinicName,
            symptom: args.symptom,
          }).catch((err) => {
            console.error('[Appointment] Email send error:', err);
          });
        }
        // 結果メッセージを組み立て
        let confirmMsg = `予約が完了しました。日時: ${args.date} ${args.time}、患者名: ${args.patient_name}`;
        if (args.doctor) {
          confirmMsg += `、担当医: ${args.doctor}`;
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
