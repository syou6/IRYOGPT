import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/supabase-auth';
import { supabaseClient } from '@/utils/supabase-client';

/**
 * GET /api/insights/conversion-impact
 * 
 * コンバージョンに影響する質問を取得するAPI
 * 
 * Query Parameters:
 * - site_id: サイトID（必須）
 * - start_date: 開始日時（ISO 8601形式、オプション）
 * - end_date: 終了日時（ISO 8601形式、オプション）
 * - limit: 取得件数（デフォルト: 20）
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
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
    const { site_id, start_date, end_date, limit } = req.query;

    if (!site_id || typeof site_id !== 'string') {
      return res.status(400).json({ message: 'site_id is required' });
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

    // 日付の変換
    const startDate = start_date ? new Date(start_date as string) : null;
    const endDate = end_date ? new Date(end_date as string) : null;
    const limitNum = limit ? parseInt(limit as string, 10) : 20;

    // コンバージョンに影響する質問を取得
    const { data, error } = await supabaseClient.rpc('get_conversion_impact_questions', {
      p_site_id: site_id,
      p_start_date: startDate?.toISOString() || null,
      p_end_date: endDate?.toISOString() || null,
      p_limit: limitNum,
    });

    if (error) {
      console.error('[Conversion Impact API] Error fetching impact questions:', error);
      return res.status(500).json({
        message: 'Failed to fetch conversion impact questions',
        error: error.message,
      });
    }

    return res.status(200).json({
      site_id,
      period: {
        start: startDate?.toISOString() || null,
        end: endDate?.toISOString() || null,
      },
      questions: data || [],
    });
  } catch (error) {
    console.error('[Conversion Impact API] Unexpected error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

