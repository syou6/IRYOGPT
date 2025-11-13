import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/supabase-auth';
import { supabaseClient } from '@/utils/supabase-client';

/**
 * POST /api/conversion/record
 * 
 * コンバージョンイベントを記録するAPI
 * 
 * Body:
 * - site_id: サイトID（必須）
 * - session_id: セッションID（必須）
 * - event_type: イベントタイプ（必須: 'purchase', 'signup', 'trial_start', 'contact', 'download'）
 * - event_value: イベントの価値（オプション、購入金額など）
 * - currency: 通貨コード（オプション、デフォルト: 'JPY'）
 * - metadata: 追加情報（オプション、JSONオブジェクト）
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // 認証チェック
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { site_id, session_id, event_type, event_value, currency, metadata } = req.body;

    // バリデーション
    if (!site_id || typeof site_id !== 'string') {
      return res.status(400).json({ message: 'site_id is required' });
    }

    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({ message: 'session_id is required' });
    }

    const validEventTypes = ['purchase', 'signup', 'trial_start', 'contact', 'download'];
    if (!event_type || !validEventTypes.includes(event_type)) {
      return res.status(400).json({ 
        message: `event_type is required and must be one of: ${validEventTypes.join(', ')}` 
      });
    }

    // サイトの所有者確認
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('id, user_id')
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (site.user_id !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // コンバージョンイベントを記録
    const { data, error } = await supabaseClient
      .from('conversion_events')
      .insert({
        user_id: userId,
        site_id: site_id,
        session_id: session_id,
        event_type: event_type,
        event_value: event_value || 0,
        currency: currency || 'JPY',
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('[Conversion API] Error recording conversion event:', error);
      return res.status(500).json({
        message: 'Failed to record conversion event',
        error: error.message,
      });
    }

    return res.status(201).json({
      message: 'Conversion event recorded successfully',
      event: data,
    });
  } catch (error) {
    console.error('[Conversion API] Unexpected error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

