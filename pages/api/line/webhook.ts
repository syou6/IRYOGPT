/**
 * LINE Webhook エンドポイント
 *
 * POST /api/line/webhook?site_id=xxx
 *
 * LINE Messaging API からの Webhook を受信し、メッセージを処理する
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { WebhookEvent } from '@line/bot-sdk';
import { supabaseClient } from '@/utils/supabase-client';
import { SiteLineConfig } from '@/types/line';
import {
  createLineClient,
  handleLineMessage,
  handleLineFollow,
  handleLineUnfollow,
} from '@/utils/line-handler';

// Next.js の body parser を無効化（LINE SDK が独自にパースするため）
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * raw body を取得
 */
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * LINE 署名を検証
 */
function validateSignature(
  body: Buffer,
  signature: string,
  channelSecret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

/**
 * サイトの LINE 設定を取得
 */
async function getSiteLineConfig(siteId: string): Promise<SiteLineConfig | null> {
  const { data, error } = await supabaseClient
    .from('sites')
    .select(`
      id,
      user_id,
      line_channel_id,
      line_channel_secret,
      line_channel_access_token,
      line_enabled,
      spreadsheet_id,
      chat_mode
    `)
    .eq('id', siteId)
    .single();

  if (error || !data) {
    console.error('[LINE Webhook] Site not found:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    lineChannelId: data.line_channel_id,
    lineChannelSecret: data.line_channel_secret,
    lineChannelAccessToken: data.line_channel_access_token,
    lineEnabled: data.line_enabled ?? false,
    spreadsheetId: data.spreadsheet_id,
    chatMode: data.chat_mode,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // POST のみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const siteId = req.query.site_id as string;

  if (!siteId) {
    console.error('[LINE Webhook] Missing site_id');
    return res.status(400).json({ message: 'site_id is required' });
  }

  try {
    // 1. サイトの LINE 設定を取得
    const siteConfig = await getSiteLineConfig(siteId);

    if (!siteConfig) {
      console.error(`[LINE Webhook] Site not found: ${siteId}`);
      return res.status(404).json({ message: 'Site not found' });
    }

    // 2. LINE 連携が無効の場合
    if (!siteConfig.lineEnabled) {
      console.error(`[LINE Webhook] LINE is not enabled for site: ${siteId}`);
      return res.status(403).json({ message: 'LINE is not enabled for this site' });
    }

    // 3. LINE 設定が不完全な場合
    if (!siteConfig.lineChannelSecret || !siteConfig.lineChannelAccessToken) {
      console.error(`[LINE Webhook] LINE config is incomplete for site: ${siteId}`);
      return res.status(400).json({ message: 'LINE configuration is incomplete' });
    }

    // 4. raw body を取得
    const rawBody = await getRawBody(req);

    // 5. 署名検証
    const signature = req.headers['x-line-signature'] as string;

    if (!signature) {
      console.error('[LINE Webhook] Missing X-Line-Signature header');
      return res.status(401).json({ message: 'Missing signature' });
    }

    if (!validateSignature(rawBody, signature, siteConfig.lineChannelSecret)) {
      console.error('[LINE Webhook] Invalid signature');
      return res.status(401).json({ message: 'Invalid signature' });
    }

    // 6. イベントをパース
    const body = JSON.parse(rawBody.toString());
    const events: WebhookEvent[] = body.events || [];

    console.log(`[LINE Webhook] Received ${events.length} events for site ${siteId}`);

    // 7. LINE クライアントを作成
    const client = createLineClient(siteConfig.lineChannelAccessToken);

    // 8. イベントを非同期で処理（3秒以内に200を返すため）
    // 重要: LINE は 3 秒以内にレスポンスがないとリトライする
    res.status(200).end();

    // 9. 各イベントを処理
    for (const event of events) {
      try {
        switch (event.type) {
          case 'message':
            await handleLineMessage(event, client, siteConfig);
            break;
          case 'follow':
            await handleLineFollow(event, client, siteConfig);
            break;
          case 'unfollow':
            await handleLineUnfollow(event, siteConfig);
            break;
          default:
            console.log(`[LINE Webhook] Unhandled event type: ${event.type}`);
        }
      } catch (eventError) {
        console.error(`[LINE Webhook] Error handling event:`, eventError);
      }
    }
  } catch (error) {
    console.error('[LINE Webhook] Error:', error);
    // すでにレスポンスを返している場合があるため、エラーはログのみ
    if (!res.headersSent) {
      return res.status(500).json({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
