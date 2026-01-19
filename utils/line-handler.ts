/**
 * LINE メッセージハンドラー
 *
 * LINE Webhook から受け取ったイベントを処理し、AI 応答を返す
 */

import { messagingApi, WebhookEvent, TextMessage } from '@line/bot-sdk';
import { SiteLineConfig, LineProfile } from '@/types/line';
import { runHybridChat, HybridChatMessage } from './makechain-hybrid';
import { getLineUserChatHistory, saveLineChatLog } from './line-history';
import { supabaseClient } from './supabase-client';

// LINE メッセージの最大文字数
const MAX_LINE_MESSAGE_LENGTH = 5000;

/**
 * LINE クライアントを作成
 */
export function createLineClient(channelAccessToken: string): messagingApi.MessagingApiClient {
  return new messagingApi.MessagingApiClient({
    channelAccessToken,
  });
}

/**
 * LINE メッセージイベントを処理
 */
export async function handleLineMessage(
  event: WebhookEvent,
  client: messagingApi.MessagingApiClient,
  siteConfig: SiteLineConfig
): Promise<void> {
  // メッセージイベント以外は無視
  if (event.type !== 'message' || event.message.type !== 'text') {
    console.log(`[LINE Handler] Ignoring non-text event: ${event.type}`);
    return;
  }

  const userMessage = event.message.text;
  const lineUserId = event.source.userId;
  const replyToken = event.replyToken;

  if (!lineUserId || !replyToken) {
    console.error('[LINE Handler] Missing userId or replyToken');
    return;
  }

  console.log(`[LINE Handler] Processing message from ${lineUserId}: ${userMessage.substring(0, 50)}...`);

  try {
    // 1. 会話履歴を取得
    const history = await getLineUserChatHistory(siteConfig.id, lineUserId);

    // 2. 現在のユーザーメッセージを追加
    const messages: HybridChatMessage[] = [
      ...history,
      { role: 'user', content: userMessage },
    ];

    // 3. ハイブリッドチャットを実行（ストリーミングなし）
    let responseText = '';

    // chat_mode に応じて処理（現状は hybrid のみサポート、appointment_only もハイブリッドで対応）
    if (siteConfig.spreadsheetId) {
      const result = await runHybridChat(
        siteConfig.id,
        siteConfig.spreadsheetId,
        messages,
        undefined // ストリーミングコールバックなし
      );
      responseText = result.message;
    } else {
      // スプレッドシート未設定の場合はエラーメッセージ
      responseText = '申し訳ございません。現在システムの設定が完了していないため、ご対応できません。';
    }

    // 4. チャットログ保存
    await saveLineChatLog(
      siteConfig.id,
      siteConfig.userId,
      lineUserId,
      userMessage,
      responseText
    );

    // 5. usage_logs に記録
    try {
      const inputTokens = Math.ceil(userMessage.length / 4);
      const outputTokens = Math.ceil(responseText.length / 4);
      const costUsd = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;

      await supabaseClient.from('usage_logs').insert({
        user_id: siteConfig.userId,
        site_id: siteConfig.id,
        action: 'chat',
        model_name: 'gpt-4o-mini',
        tokens_consumed: inputTokens + outputTokens,
        cost_usd: costUsd,
        metadata: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          question_length: userMessage.length,
          source: 'line',
          mode: siteConfig.chatMode || 'hybrid',
        },
      });
    } catch (logError) {
      console.error('[LINE Handler] Failed to log usage:', logError);
    }

    // 6. LINE 返信（長文の場合は分割）
    const replyMessages = splitLongMessage(responseText);
    await client.replyMessage({
      replyToken,
      messages: replyMessages,
    });

    console.log(`[LINE Handler] Replied to ${lineUserId}`);
  } catch (error) {
    console.error('[LINE Handler] Error processing message:', error);

    // エラー時の返信
    try {
      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: '申し訳ございません。エラーが発生しました。しばらくしてから再度お試しください。',
          },
        ],
      });
    } catch (replyError) {
      console.error('[LINE Handler] Failed to send error reply:', replyError);
    }
  }
}

/**
 * LINE フォローイベントを処理（友だち追加）
 */
export async function handleLineFollow(
  event: WebhookEvent,
  client: messagingApi.MessagingApiClient,
  siteConfig: SiteLineConfig
): Promise<void> {
  if (event.type !== 'follow') {
    return;
  }

  const lineUserId = event.source.userId;
  const replyToken = event.replyToken;

  if (!lineUserId) {
    console.error('[LINE Handler] Missing userId for follow event');
    return;
  }

  console.log(`[LINE Handler] New follower: ${lineUserId}`);

  try {
    // 1. ユーザープロフィールを取得
    let profile: LineProfile | null = null;
    try {
      const profileResponse = await client.getProfile(lineUserId);
      profile = {
        userId: profileResponse.userId,
        displayName: profileResponse.displayName,
        pictureUrl: profileResponse.pictureUrl,
        statusMessage: profileResponse.statusMessage,
      };
    } catch (profileError) {
      console.warn('[LINE Handler] Could not get user profile:', profileError);
    }

    // 2. line_users テーブルに保存（upsert）
    const { error: upsertError } = await supabaseClient
      .from('line_users')
      .upsert({
        site_id: siteConfig.id,
        line_user_id: lineUserId,
        display_name: profile?.displayName || null,
        picture_url: profile?.pictureUrl || null,
        status_message: profile?.statusMessage || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'site_id,line_user_id',
      });

    if (upsertError) {
      console.error('[LINE Handler] Failed to save line_user:', upsertError);
    }

    // 3. ウェルカムメッセージを送信
    if (replyToken) {
      const welcomeMessage = profile?.displayName
        ? `${profile.displayName}さん、友だち追加ありがとうございます！\n\nご予約や診療に関するご質問がございましたら、お気軽にメッセージをお送りください。`
        : `友だち追加ありがとうございます！\n\nご予約や診療に関するご質問がございましたら、お気軽にメッセージをお送りください。`;

      await client.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: welcomeMessage,
          },
        ],
      });
    }

    console.log(`[LINE Handler] Processed follow event for ${lineUserId}`);
  } catch (error) {
    console.error('[LINE Handler] Error processing follow event:', error);
  }
}

/**
 * LINE アンフォローイベントを処理（ブロック）
 */
export async function handleLineUnfollow(
  event: WebhookEvent,
  siteConfig: SiteLineConfig
): Promise<void> {
  if (event.type !== 'unfollow') {
    return;
  }

  const lineUserId = event.source.userId;

  if (!lineUserId) {
    console.error('[LINE Handler] Missing userId for unfollow event');
    return;
  }

  console.log(`[LINE Handler] User unfollowed: ${lineUserId}`);

  // 必要に応じて line_users テーブルから削除
  // （履歴保持のため、今回は削除しない）
}

/**
 * 長いメッセージを分割
 */
function splitLongMessage(text: string): TextMessage[] {
  if (text.length <= MAX_LINE_MESSAGE_LENGTH) {
    return [{ type: 'text', text }];
  }

  const messages: TextMessage[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_LINE_MESSAGE_LENGTH) {
      messages.push({ type: 'text', text: remaining });
      break;
    }

    // 改行か句点で区切りを見つける
    let splitIndex = remaining.lastIndexOf('\n', MAX_LINE_MESSAGE_LENGTH);
    if (splitIndex === -1 || splitIndex < MAX_LINE_MESSAGE_LENGTH / 2) {
      splitIndex = remaining.lastIndexOf('。', MAX_LINE_MESSAGE_LENGTH);
    }
    if (splitIndex === -1 || splitIndex < MAX_LINE_MESSAGE_LENGTH / 2) {
      splitIndex = MAX_LINE_MESSAGE_LENGTH;
    } else {
      splitIndex += 1; // 区切り文字を含める
    }

    messages.push({ type: 'text', text: remaining.substring(0, splitIndex) });
    remaining = remaining.substring(splitIndex);

    // 最大5つまで
    if (messages.length >= 5) {
      if (remaining.length > 0) {
        messages[4].text += '\n\n（続きは省略されました）';
      }
      break;
    }
  }

  return messages;
}
