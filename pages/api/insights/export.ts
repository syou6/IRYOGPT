import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/utils/supabase-auth';
import { supabaseClient } from '@/utils/supabase-client';

/**
 * GET /api/insights/export
 * 
 * チャットログをCSV形式でエクスポートするAPI
 * 
 * Query Parameters:
 * - site_id: サイトID（必須）
 * - start_date: 開始日時（ISO 8601形式、オプション）
 * - end_date: 終了日時（ISO 8601形式、オプション）
 * - format: エクスポート形式（'csv' または 'json'、デフォルト: 'csv'）
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
    const { site_id, start_date, end_date, format = 'csv' } = req.query;

    if (!site_id || typeof site_id !== 'string') {
      return res.status(400).json({ message: 'site_id is required' });
    }

    // サイトの所有者確認
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('id, user_id, name')
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

    // チャットログを取得
    let query = supabaseClient
      .from('chat_logs')
      .select('id, question, answer, session_id, source, user_agent, referrer, created_at')
      .eq('site_id', site_id)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('[Export API] Error fetching chat logs:', error);
      return res.status(500).json({
        message: 'Failed to fetch chat logs',
        error: error.message,
      });
    }

    // CSV形式でエクスポート
    if (format === 'csv') {
      // CSVエスケープ関数（RFC 4180準拠）
      const escapeCsv = (value: string | null | undefined): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // ダブルクォート、改行、カンマを含む場合はダブルクォートで囲む
        if (str.includes('"') || str.includes('\n') || str.includes(',') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // CSVヘッダー
      const headers = ['ID', '質問', '回答', 'セッションID', '発生元', 'ユーザーエージェント', 'リファラー', '作成日時'];
      
      // CSV行を生成
      const csvRows = [
        headers.join(','),
        ...(logs || []).map((log) => [
          escapeCsv(log.id),
          escapeCsv(log.question),
          escapeCsv(log.answer),
          escapeCsv(log.session_id),
          escapeCsv(log.source),
          escapeCsv(log.user_agent),
          escapeCsv(log.referrer),
          escapeCsv(log.created_at ? new Date(log.created_at).toISOString() : ''),
        ].join(',')),
      ];

      const csvContent = csvRows.join('\n');
      // BOMを追加してExcelで正しく開けるようにする
      const csvWithBom = '\ufeff' + csvContent;

      // ファイル名を生成（サイト名_日付.csv）
      const siteName = site.name.replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${siteName}_${dateStr}.csv`;

      // CSVレスポンスを返す
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', Buffer.byteLength(csvWithBom, 'utf8'));

      return res.status(200).send(csvWithBom);
    }

    // JSON形式でエクスポート
    return res.status(200).json({
      site_id,
      site_name: site.name,
      period: {
        start: startDate?.toISOString() || null,
        end: endDate?.toISOString() || null,
      },
      total: logs?.length || 0,
      logs: logs || [],
    });
  } catch (error) {
    console.error('[Export API] Unexpected error:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

