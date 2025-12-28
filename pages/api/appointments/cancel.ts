import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { cancelAppointment } from '@/utils/appointment';

/**
 * 予約キャンセルAPI
 *
 * POST /api/appointments/cancel
 *
 * Body:
 * {
 *   site_id: "xxx",
 *   date: "2025/1/25",
 *   time: "10:00"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "予約をキャンセルしました"
 * }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { site_id, date, time } = req.body;

    // バリデーション
    if (!site_id) {
      return res.status(400).json({ error: 'site_id is required' });
    }
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    if (!time) {
      return res.status(400).json({ error: 'time is required' });
    }

    // Authorization ヘッダーからトークンを取得
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);

    // トークンを検証してユーザー情報を取得
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // サイト情報を取得
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('id, user_id, spreadsheet_id')
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // 所有者チェック
    if (site.user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!site.spreadsheet_id) {
      return res.status(400).json({
        error: 'Spreadsheet not configured',
      });
    }

    const result = await cancelAppointment(site.spreadsheet_id, date, time);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error canceling appointment:', error);
    return res.status(500).json({
      error: 'Failed to cancel appointment',
      message: error.message,
    });
  }
}
