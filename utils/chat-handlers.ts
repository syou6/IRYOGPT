/**
 * 予約チャット・ハイブリッドチャットの共通ハンドラー
 *
 * pages/api/chat.ts (dashboard) と pages/api/embed/chat.ts (embed) の
 * 両方から使用される共通ロジックをここに集約する。
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { runAppointmentChat, AppointmentChatMessage } from '@/utils/makechain-appointment';
import { runHybridChat, HybridChatMessage } from '@/utils/makechain-hybrid';
import { getSafeStreamingError } from '@/utils/error-handler';
import { generateSessionId } from '@/utils/id-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** チャットログの送信元区分 */
export type ChatSource = 'dashboard' | 'embed';

/** ストリーミングレスポンスに付加する追加ヘッダー（CORSなど） */
export type ExtraStreamHeaders = Record<string, string>;

/** 予約チャット・ハイブリッドチャット共通のオプション */
interface ChatHandlerOptions {
  /** 送信元区分（usage_logs / chat_logs の source フィールドに記録） */
  source: ChatSource;
  /**
   * true の場合、runXxxChat が onToken コールバックを一度も呼ばなかったときに
   * result.message をまとめて送信する（embed エンドポイントの挙動）。
   * false の場合はスキップ（dashboard エンドポイントの挙動）。
   */
  sendUnstreamed: boolean;
  /**
   * true の場合、予約完了時に `{ appointmentCreated: true }` イベントを送信する
   * （embed エンドポイントの挙動）。
   */
  notifyAppointmentCreated: boolean;
  /** SSE レスポンスヘッダーに追加するフィールド（Access-Control-* など） */
  extraStreamHeaders?: ExtraStreamHeaders;
}

// ---------------------------------------------------------------------------
// Token / cost helpers (local copies — same formula used in both API files)
// ---------------------------------------------------------------------------

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 0.15;
  const outputCost = (outputTokens / 1_000_000) * 0.60;
  return inputCost + outputCost;
}

// ---------------------------------------------------------------------------
// History conversion helpers
// ---------------------------------------------------------------------------

/**
 * 会話履歴を AppointmentChatMessage 配列に変換する。
 * タプル形式 `[string, string][]` と `{ role, content }[]` の両方を受け付ける。
 */
function convertToAppointmentMessages(
  history: any[] | undefined,
  currentQuestion: string,
): AppointmentChatMessage[] {
  const messages: AppointmentChatMessage[] = [];

  if (history && Array.isArray(history)) {
    for (const item of history) {
      if (Array.isArray(item) && item.length === 2) {
        messages.push({ role: 'user', content: item[0] });
        messages.push({ role: 'assistant', content: item[1] });
      } else if (item && item.role && item.content) {
        messages.push({
          role: item.role as 'user' | 'assistant',
          content: item.content,
        });
      }
    }
  }

  messages.push({ role: 'user', content: currentQuestion.trim() });
  return messages;
}

/**
 * 会話履歴を HybridChatMessage 配列に変換する。
 * タプル形式 `[string, string][]` と `{ role, content }[]` の両方を受け付ける。
 */
function convertToHybridMessages(
  history: any[] | undefined,
  currentQuestion: string,
): HybridChatMessage[] {
  const messages: HybridChatMessage[] = [];

  if (history && Array.isArray(history)) {
    for (const item of history) {
      if (Array.isArray(item) && item.length === 2) {
        messages.push({ role: 'user', content: item[0] });
        messages.push({ role: 'assistant', content: item[1] });
      } else if (item && item.role && item.content) {
        messages.push({
          role: item.role as 'user' | 'assistant',
          content: item.content,
        });
      }
    }
  }

  messages.push({ role: 'user', content: currentQuestion.trim() });
  return messages;
}

// ---------------------------------------------------------------------------
// Shared SSE helpers
// ---------------------------------------------------------------------------

function startSseResponse(
  res: NextApiResponse,
  extraHeaders?: ExtraStreamHeaders,
): void {
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    ...extraHeaders,
  };
  res.writeHead(200, headers);
}

function makeSender(res: NextApiResponse): (data: string) => void {
  return (data: string) => {
    res.write(`data: ${data}\n\n`);
  };
}

// ---------------------------------------------------------------------------
// Shared logging helpers
// ---------------------------------------------------------------------------

async function logUsage(params: {
  userId: string;
  siteId: string;
  question: string;
  outputText: string;
  mode: 'appointment' | 'hybrid';
  source: ChatSource;
  ragContextFound?: boolean;
}): Promise<void> {
  try {
    const inputTokens = estimateTokens(params.question);
    const outputTokens = estimateTokens(params.outputText);
    const costUsd = calculateCost(inputTokens, outputTokens);

    const metadata: Record<string, unknown> = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      question_length: params.question.length,
      source: params.source,
      mode: params.mode,
    };

    if (params.mode === 'hybrid' && params.ragContextFound !== undefined) {
      metadata.rag_context_found = params.ragContextFound;
    }

    await supabaseClient.from('usage_logs').insert({
      user_id: params.userId,
      site_id: params.siteId,
      action: 'chat',
      model_name: 'gpt-4o-mini',
      tokens_consumed: inputTokens + outputTokens,
      cost_usd: costUsd,
      metadata,
    });
  } catch (logError) {
    console.error('[chat-handlers] Failed to log usage:', logError);
  }
}

async function logChatEntry(params: {
  req: NextApiRequest;
  userId: string;
  siteId: string;
  question: string;
  outputText: string;
  source: ChatSource;
}): Promise<void> {
  try {
    const sessionId = params.req.body.session_id || generateSessionId();

    await supabaseClient.from('chat_logs').insert({
      user_id: params.userId,
      site_id: params.siteId,
      question: params.question.trim(),
      answer: params.outputText,
      session_id: sessionId,
      source: params.source,
      user_agent: params.req.headers['user-agent'] || null,
      referrer: params.req.headers['referer'] || null,
    });
  } catch (logError) {
    console.error('[chat-handlers] Failed to save chat log:', logError);
  }
}

// ---------------------------------------------------------------------------
// Public handlers
// ---------------------------------------------------------------------------

/**
 * 予約チャット処理（appointment_only モード）
 *
 * dashboard と embed の両エンドポイントから呼び出す。
 * 差異は `options` で制御する。
 */
export async function handleAppointmentChat(
  req: NextApiRequest,
  res: NextApiResponse,
  params: {
    userId: string;
    siteId: string;
    spreadsheetId: string;
    question: string;
    history: any[] | undefined;
  },
  options: ChatHandlerOptions,
): Promise<void> {
  const { userId, siteId, spreadsheetId, question, history } = params;
  const { source, sendUnstreamed, notifyAppointmentCreated, extraStreamHeaders } = options;

  const messages = convertToAppointmentMessages(history, question);

  startSseResponse(res, extraStreamHeaders);
  const sendData = makeSender(res);

  sendData(JSON.stringify({ data: '' }));

  let outputText = '';
  let hasStreamed = false;

  try {
    const result = await runAppointmentChat(
      spreadsheetId,
      messages,
      (token: string) => {
        hasStreamed = true;
        outputText += token;
        sendData(JSON.stringify({ data: token }));
      },
    );

    if (sendUnstreamed && !hasStreamed && result.message) {
      outputText = result.message;
      sendData(JSON.stringify({ data: result.message }));
    }

    if (notifyAppointmentCreated && result.appointmentCreated) {
      sendData(JSON.stringify({ appointmentCreated: true }));
    }

    await logUsage({ userId, siteId, question, outputText, mode: 'appointment', source });
    await logChatEntry({ req, userId, siteId, question, outputText, source });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[chat-handlers] Appointment chat completed (${source})`);
    }
  } catch (error) {
    console.error(`[chat-handlers] Appointment chat error (${source}):`, error);
    sendData(JSON.stringify({ error: getSafeStreamingError(error) }));
  } finally {
    sendData('[DONE]');
    res.end();
  }
}

/**
 * ハイブリッドチャット処理（hybrid モード、RAG + 予約機能）
 *
 * dashboard と embed の両エンドポイントから呼び出す。
 * 差異は `options` で制御する。
 */
export async function handleHybridChat(
  req: NextApiRequest,
  res: NextApiResponse,
  params: {
    userId: string;
    siteId: string;
    spreadsheetId: string;
    question: string;
    history: any[] | undefined;
  },
  options: ChatHandlerOptions,
): Promise<void> {
  const { userId, siteId, spreadsheetId, question, history } = params;
  const { source, sendUnstreamed, notifyAppointmentCreated, extraStreamHeaders } = options;

  const messages = convertToHybridMessages(history, question);

  startSseResponse(res, extraStreamHeaders);
  const sendData = makeSender(res);

  sendData(JSON.stringify({ data: '' }));

  let outputText = '';
  let hasStreamed = false;

  try {
    const result = await runHybridChat(
      siteId,
      spreadsheetId,
      messages,
      (token: string) => {
        hasStreamed = true;
        outputText += token;
        sendData(JSON.stringify({ data: token }));
      },
    );

    if (sendUnstreamed && !hasStreamed && result.message) {
      outputText = result.message;
      sendData(JSON.stringify({ data: result.message }));
    }

    if (notifyAppointmentCreated && result.appointmentCreated) {
      sendData(JSON.stringify({ appointmentCreated: true }));
    }

    await logUsage({
      userId,
      siteId,
      question,
      outputText,
      mode: 'hybrid',
      source,
      ragContextFound: result.ragContext !== 'WEBサイト情報は見つかりませんでした',
    });
    await logChatEntry({ req, userId, siteId, question, outputText, source });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[chat-handlers] Hybrid chat completed (${source})`);
    }
  } catch (error) {
    console.error(`[chat-handlers] Hybrid chat error (${source}):`, error);
    sendData(JSON.stringify({ error: getSafeStreamingError(error) }));
  } finally {
    sendData('[DONE]');
    res.end();
  }
}
