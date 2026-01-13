/**
 * 医療予約対応用のチャットチェーン
 * OpenAI Function Calling を使用して予約処理を行う
 */

import { ChatOpenAI } from '@langchain/openai';
import {
  getMedicalSystemPrompt,
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
  // システムプロンプトを追加（今日の日付情報を含む）
  const fullMessages = [
    { role: 'system' as const, content: getMedicalSystemPrompt() },
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
    case 'get_available_slots': {
      const slots = await getAvailableSlots(spreadsheetId, args.date);
      if (slots.length === 0) {
        return `${args.date}は休診日のため、予約枠がありません。別の日をお選びください。`;
      }
      const availableSlots = slots.filter((s: TimeSlot) => s.available);
      if (availableSlots.length === 0) {
        return `${args.date}は予約が埋まっています。別の日をお選びください。`;
      }
      const timeList = availableSlots.map((s: TimeSlot) => s.time).join(', ');
      return `${args.date}の空き枠: ${timeList}`;
    }

    case 'create_appointment': {
      const result = await createAppointment(spreadsheetId, {
        date: args.date,
        time: args.time,
        patientName: args.patient_name,
        patientPhone: args.patient_phone,
        patientEmail: args.patient_email || '',
        symptom: args.symptom || '',
        bookedVia: 'ChatBot',
      });

      if (result.success) {
        // メール送信（患者にメールアドレスがある場合）
        if (args.patient_email) {
          const settings = await getClinicSettings(spreadsheetId);
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
        return `予約が完了しました。日時: ${args.date} ${args.time}、患者名: ${args.patient_name}`;
      } else {
        return `予約に失敗しました: ${result.message}`;
      }
    }

    case 'get_clinic_info': {
      const settings = await getClinicSettings(spreadsheetId);
      return `医院名: ${settings.clinicName}
診療時間: ${settings.startTime}〜${settings.endTime}
昼休み: ${settings.breakStart}〜${settings.breakEnd}
1枠: ${settings.slotDuration}分
休診曜日: ${settings.closedDays.join('、')}`;
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
