/**
 * LINE 会話履歴管理
 *
 * LINE ユーザーごとの会話履歴を chat_logs テーブルから取得・保存する
 */

import { supabaseClient } from './supabase-client';
import { HybridChatMessage } from './makechain-hybrid';

// 取得する会話履歴の最大件数
const MAX_HISTORY_COUNT = 10;

/**
 * LINE ユーザーの会話履歴を取得
 *
 * @param siteId サイトID
 * @param lineUserId LINE ユーザーID
 * @returns HybridChatMessage[] 形式の会話履歴
 */
export async function getLineUserChatHistory(
  siteId: string,
  lineUserId: string
): Promise<HybridChatMessage[]> {
  try {
    // session_id = `line_${lineUserId}` で履歴を取得
    const sessionId = `line_${lineUserId}`;

    const { data, error } = await supabaseClient
      .from('chat_logs')
      .select('question, answer, created_at')
      .eq('site_id', siteId)
      .eq('session_id', sessionId)
      .eq('source', 'line')
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_COUNT);

    if (error) {
      console.error('[LINE History] Error fetching history:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 時系列順に並び替え（古い順）
    const sortedData = data.reverse();

    // HybridChatMessage 形式に変換
    const messages: HybridChatMessage[] = [];
    for (const log of sortedData) {
      messages.push({ role: 'user', content: log.question });
      messages.push({ role: 'assistant', content: log.answer });
    }

    console.log(`[LINE History] Retrieved ${sortedData.length} conversations for user ${lineUserId}`);
    return messages;
  } catch (error) {
    console.error('[LINE History] Exception fetching history:', error);
    return [];
  }
}

/**
 * LINE 会話ログを保存
 *
 * @param siteId サイトID
 * @param userId サイト所有者のユーザーID
 * @param lineUserId LINE ユーザーID
 * @param question ユーザーの質問
 * @param answer AI の回答
 */
export async function saveLineChatLog(
  siteId: string,
  userId: string,
  lineUserId: string,
  question: string,
  answer: string
): Promise<void> {
  try {
    const sessionId = `line_${lineUserId}`;

    const { error } = await supabaseClient.from('chat_logs').insert({
      user_id: userId,
      site_id: siteId,
      question: question,
      answer: answer,
      session_id: sessionId,
      source: 'line',
    });

    if (error) {
      console.error('[LINE History] Error saving chat log:', error);
    } else {
      console.log(`[LINE History] Saved chat log for user ${lineUserId}`);
    }
  } catch (error) {
    console.error('[LINE History] Exception saving chat log:', error);
  }
}

/**
 * LINE ユーザーの会話履歴をクリア
 *
 * @param siteId サイトID
 * @param lineUserId LINE ユーザーID
 */
export async function clearLineUserChatHistory(
  siteId: string,
  lineUserId: string
): Promise<void> {
  try {
    const sessionId = `line_${lineUserId}`;

    const { error } = await supabaseClient
      .from('chat_logs')
      .delete()
      .eq('site_id', siteId)
      .eq('session_id', sessionId)
      .eq('source', 'line');

    if (error) {
      console.error('[LINE History] Error clearing history:', error);
    } else {
      console.log(`[LINE History] Cleared history for user ${lineUserId}`);
    }
  } catch (error) {
    console.error('[LINE History] Exception clearing history:', error);
  }
}
