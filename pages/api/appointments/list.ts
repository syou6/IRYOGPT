import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { getAllAppointments, getClinicSettings } from '@/utils/appointment';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';

/**
 * GET /api/appointments/list
 *
 * 予約一覧を取得
 *
 * Query params:
 * - site_id: サイトID（必須）
 * - start_date: 開始日（YYYY/M/D形式、オプション）
 * - end_date: 終了日（YYYY/M/D形式、オプション）
 * - include_cancel: キャンセル済みを含むか（true/false、デフォルト: false）
 * - view: 表示モード（today/week/all、デフォルト: week）
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      site_id,
      start_date,
      end_date,
      include_cancel,
      view = 'week',
    } = req.query;

    if (!site_id || typeof site_id !== 'string') {
      return res.status(400).json({ error: 'site_id is required' });
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

    // 所有者チェック（または管理者チェック）
    if (site.user_id !== user.id) {
      // TODO: 管理者チェックを追加
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!site.spreadsheet_id) {
      return res.status(400).json({
        error: 'Spreadsheet not configured',
        message: 'このサイトには予約システムが設定されていません。',
      });
    }

    // 日付範囲を決定
    let startDateStr: string | undefined;
    let endDateStr: string | undefined;

    if (start_date && typeof start_date === 'string') {
      startDateStr = start_date;
    }
    if (end_date && typeof end_date === 'string') {
      endDateStr = end_date;
    }

    // view モードに基づいてデフォルトの日付範囲を設定
    if (!startDateStr && !endDateStr) {
      const today = new Date();

      switch (view) {
        case 'today':
          startDateStr = format(today, 'yyyy/M/d');
          endDateStr = format(today, 'yyyy/M/d');
          break;
        case 'week':
          const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // 月曜始まり
          const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
          startDateStr = format(weekStart, 'yyyy/M/d');
          endDateStr = format(weekEnd, 'yyyy/M/d');
          break;
        case 'all':
          // 全件取得（フィルタなし）
          break;
      }
    }

    // 予約一覧を取得
    const appointments = await getAllAppointments(site.spreadsheet_id, {
      startDate: startDateStr,
      endDate: endDateStr,
      includeCancel: include_cancel === 'true',
    });

    // 医院設定を取得
    const settings = await getClinicSettings(site.spreadsheet_id);

    return res.status(200).json({
      appointments,
      clinic: {
        name: settings.clinicName,
        startTime: settings.startTime,
        endTime: settings.endTime,
      },
      dateRange: {
        start: startDateStr,
        end: endDateStr,
      },
      total: appointments.length,
    });
  } catch (error: any) {
    console.error('[Appointments List API] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
