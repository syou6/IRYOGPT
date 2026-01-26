import type { NextApiRequest, NextApiResponse } from 'next';
import { runAppointmentChat, AppointmentChatMessage } from '@/utils/makechain-appointment';
import { supabaseClient } from '@/utils/supabase-client';
import { setCorsHeaders, handlePreflight } from '@/utils/cors';

/**
 * 予約対応チャットAPI
 *
 * POST /api/appointments/chat
 *
 * Body:
 * {
 *   site_id: "xxx",
 *   message: "予約したいです",
 *   history: [
 *     { role: "user", content: "こんにちは" },
 *     { role: "assistant", content: "こんにちは！ご予約でしょうか？" }
 *   ]
 * }
 *
 * Response (streaming):
 * data: {"data": "トークン"}
 * data: {"data": "トークン"}
 * ...
 * data: [DONE]
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // OPTIONSリクエスト（プリフライト）はリクエストのOriginを許可
  if (handlePreflight(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { site_id, message, history } = req.body;

    if (!site_id) {
      return res.status(400).json({ error: 'site_id is required' });
    }

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // サイト情報を取得（spreadsheet_id, base_url を含む）
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('id, spreadsheet_id, is_embed_enabled, base_url')
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // CORS検証（サイトのbase_urlと一致するOriginのみ許可）
    const corsAllowed = setCorsHeaders(req, res, site.base_url);
    if (!corsAllowed) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    if (!site.spreadsheet_id) {
      return res.status(400).json({
        error: 'Spreadsheet not configured for this site',
        message: 'このサイトにはまだ予約システムが設定されていません。'
      });
    }

    // 会話履歴を構築
    const messages: AppointmentChatMessage[] = [
      ...(history || []),
      { role: 'user' as const, content: message },
    ];

    // ストリーミングレスポンスの開始
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    const sendData = (data: string) => {
      res.write(`data: ${data}\n\n`);
    };

    let hasStreamed = false;

    try {
      const result = await runAppointmentChat(
        site.spreadsheet_id,
        messages,
        (token: string) => {
          hasStreamed = true;
          sendData(JSON.stringify({ data: token }));
        }
      );

      // ストリーミングされなかった場合のみ結果を送信
      if (!hasStreamed && result.message) {
        sendData(JSON.stringify({ data: result.message }));
      }

      // 予約が完了した場合は通知
      if (result.appointmentCreated) {
        sendData(JSON.stringify({ appointmentCreated: true }));
      }

    } catch (error: any) {
      console.error('[Appointment Chat API] Error:', error);
      sendData(JSON.stringify({ error: error.message }));
    } finally {
      sendData('[DONE]');
      res.end();
    }

  } catch (error: any) {
    console.error('[Appointment Chat API] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
