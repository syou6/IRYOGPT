/**
 * ハイブリッドモード用のチャットチェーン
 * RAG検索 + 予約機能（OpenAI Function Calling）を組み合わせる
 */

import { ChatOpenAI } from '@langchain/openai';
import { getClinicSettings } from './appointment';
import { APPOINTMENT_TOOLS } from './prompts/medical-appointment';
import { searchRAG, getHybridSystemPrompt } from './hybrid/prompt-builder';
import { executeToolCall, ToolExecutorContext } from './hybrid/tool-executor';

// Re-export types for backward compatibility
export type { HybridChatMessage, HybridChatResult } from './hybrid/types';

/**
 * ハイブリッドチャットを実行
 */
export async function runHybridChat(
  siteId: string,
  spreadsheetId: string,
  messages: import('./hybrid/types').HybridChatMessage[],
  onToken?: (token: string) => void,
  context?: ToolExecutorContext
): Promise<import('./hybrid/types').HybridChatResult> {
  // ① 設定を取得（AIがget_clinic_infoを呼ばなくても設定を知れるように）
  const settings = await getClinicSettings(spreadsheetId);

  // ② RAG検索を実行（最新のユーザーメッセージで検索）
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  const query = lastUserMessage?.content || '';

  let ragContext = 'WEBサイト情報は見つかりませんでした';
  try {
    ragContext = await searchRAG(siteId, query);
  } catch (error) {
    console.error('[Hybrid] RAG search failed, continuing with appointment only:', error);
  }

  // ③ システムプロンプトを生成（RAG情報 + 医院設定を含む）
  const systemPrompt = getHybridSystemPrompt(ragContext, settings);

  // ④ 日付が含まれていたら先に空き状況を取得（AIの判断を待たない）
  const preloadedSlots = await preloadSlotsIfDateMentioned(spreadsheetId, query);

  const fullMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages,
  ];

  if (preloadedSlots) {
    fullMessages.push({
      role: 'system' as const,
      content: `【空き状況（既に取得済み）】\n${preloadedSlots}\n\n上記の空き状況を即座にユーザーに伝えてください。「確認します」「お待ちください」は絶対に言わないでください。`,
    });
  }

  // ⑤ 最初の呼び出し（ツール判定用、ストリーミングなし）
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    streaming: false,
  });

  let response;
  try {
    response = await model.invoke(fullMessages as any, {
      tools: APPOINTMENT_TOOLS,
      tool_choice: 'required',
    });
  } catch (error) {
    console.error('[Hybrid] LLM invoke error:', error);
    throw error;
  }

  // ⑥ ツール呼び出しを処理
  if (!response.tool_calls || response.tool_calls.length === 0) {
    console.error('[Hybrid] No tool calls despite tool_choice=required');
    return {
      message: 'ご質問にお答えできませんでした。もう一度お試しください。',
      ragContext,
    };
  }

  const sendMessageCall = response.tool_calls.find((tc: any) => tc.name === 'send_message');
  const otherToolCalls = response.tool_calls.filter((tc: any) => tc.name !== 'send_message');

  if (otherToolCalls.length > 0) {
    return handleToolExecution(
      fullMessages,
      response,
      otherToolCalls,
      sendMessageCall,
      spreadsheetId,
      ragContext,
      onToken,
      context
    );
  }

  // send_message のみの場合
  return handleSendMessageOnly(
    fullMessages,
    sendMessageCall!,
    spreadsheetId,
    query,
    ragContext,
    onToken
  );
}

/**
 * 日付が言及されていれば空き状況をプリロード
 */
async function preloadSlotsIfDateMentioned(
  spreadsheetId: string,
  query: string
): Promise<string | null> {
  const datePatterns = [
    /(\d{1,2})月(\d{1,2})日/,
    /(\d{1,2})日/,
    /明日/,
    /明後日/,
    /来週/,
    /(\d{1,2})時/,
  ];
  const hasDateMention = datePatterns.some(p => p.test(query));

  if (!hasDateMention) return null;

  console.log('[Hybrid] Date mentioned, preloading slots for:', query);

  try {
    const targetDate = extractDateFromQuery(query);
    if (!targetDate) return null;

    const slots = await executeToolCall(spreadsheetId, {
      name: 'get_available_slots',
      args: { date: targetDate },
    });
    console.log('[Hybrid] Preloaded slots:', slots);
    return slots;
  } catch (error) {
    console.error('[Hybrid] Preload slots failed:', error);
    return null;
  }
}

/**
 * クエリ文字列から日付文字列（YYYY/M/D）を抽出
 */
function extractDateFromQuery(query: string): string | null {
  const today = new Date();

  const fullDateMatch = query.match(/(\d{1,2})月(\d{1,2})日/);
  if (fullDateMatch) {
    const month = parseInt(fullDateMatch[1]);
    const day = parseInt(fullDateMatch[2]);
    return `${today.getFullYear()}/${month}/${day}`;
  }

  const dayOnlyMatch = query.match(/(\d{1,2})日/);
  if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1]);
    const month = today.getMonth() + 1;
    return `${today.getFullYear()}/${month}/${day}`;
  }

  if (query.includes('明日')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}/${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
  }

  if (query.includes('明後日')) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return `${dayAfter.getFullYear()}/${dayAfter.getMonth() + 1}/${dayAfter.getDate()}`;
  }

  return null;
}

/**
 * 予約ツール等の実ツール呼び出し処理
 */
async function handleToolExecution(
  fullMessages: any[],
  response: any,
  otherToolCalls: any[],
  sendMessageCall: any,
  spreadsheetId: string,
  ragContext: string,
  onToken?: (token: string) => void,
  context?: ToolExecutorContext
): Promise<import('./hybrid/types').HybridChatResult> {
  const toolResults: any[] = [];
  let appointmentCreated = false;

  for (const toolCall of otherToolCalls) {
    let result: string;
    try {
      result = await executeToolCall(spreadsheetId, toolCall, context);
    } catch (error) {
      console.error('[Hybrid] Tool call failed:', error);
      result = 'ツールの実行に失敗しました。しばらくしてからお試しください。';
    }

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
    { role: 'assistant' as const, content: '', tool_calls: response.tool_calls },
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
      ? [{ handleLLMNewToken: (token: string) => onToken(token) }]
      : undefined,
  });

  return {
    message: finalResponse.content as string,
    toolCalls: otherToolCalls,
    appointmentCreated,
    ragContext,
  };
}

/**
 * send_message のみの場合の処理
 * 禁止ワード検出時はget_available_slotsを強制呼び出し
 */
async function handleSendMessageOnly(
  fullMessages: any[],
  sendMessageCall: any,
  spreadsheetId: string,
  query: string,
  ragContext: string,
  onToken?: (token: string) => void
): Promise<import('./hybrid/types').HybridChatResult> {
  const messageText = sendMessageCall.args?.message || '';

  const hasForbiddenPhrase = /お待ちください|確認いたします|確認します|お調べします/.test(messageText);
  const userMentionedDate = /\d+日|\d+時|明日|明後日|来週/.test(query);

  if (hasForbiddenPhrase && userMentionedDate) {
    console.log('[Hybrid] Forbidden phrase detected, forcing get_available_slots');
    const dateMatch = query.match(/(\d+)月(\d+)日/) || query.match(/(\d+)日/);

    if (dateMatch) {
      const today = new Date();
      const month = dateMatch.length === 3 ? parseInt(dateMatch[1]) : today.getMonth() + 1;
      const day = dateMatch.length === 3 ? parseInt(dateMatch[2]) : parseInt(dateMatch[1]);
      const targetDate = `${today.getFullYear()}/${month}/${day}`;

      const toolResult = await executeToolCall(spreadsheetId, {
        name: 'get_available_slots',
        args: { date: targetDate },
      });

      const retryMessages = [
        ...fullMessages,
        {
          role: 'assistant' as const,
          content: '',
          tool_calls: [{ id: 'forced_slots', name: 'get_available_slots', args: { date: targetDate } }],
        },
        { role: 'tool' as const, content: toolResult, tool_call_id: 'forced_slots' },
        {
          role: 'system' as const,
          content: '【重要】上記の空き状況を即座にユーザーに伝えてください。「お待ちください」は絶対に言うな。',
        },
      ];

      const retryModel = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        streaming: Boolean(onToken),
      });

      const retryResponse = await retryModel.invoke(retryMessages as any, {
        callbacks: onToken
          ? [{ handleLLMNewToken: (token: string) => onToken(token) }]
          : undefined,
      });

      return {
        message: retryResponse.content as string,
        toolCalls: [{ name: 'get_available_slots', args: { date: targetDate } }],
        ragContext,
      };
    }
  }

  if (onToken) {
    for (const char of messageText) {
      onToken(char);
    }
  }

  return { message: messageText, ragContext };
}
