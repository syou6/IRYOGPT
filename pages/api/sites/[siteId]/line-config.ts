/**
 * LINE 設定 API
 *
 * GET /api/sites/[siteId]/line-config - LINE 設定を取得
 * PUT /api/sites/[siteId]/line-config - LINE 設定を更新
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { requireAuth } from '@/utils/supabase-auth';

// トークンをマスク
function maskToken(token: string | null): string {
  if (!token) return '';
  if (token.length <= 8) return '********';
  return token.substring(0, 4) + '****' + token.substring(token.length - 4);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // 認証チェック
    const userId = await requireAuth(req);
    const { siteId } = req.query;

    if (!siteId || typeof siteId !== 'string') {
      return res.status(400).json({ message: 'siteId is required' });
    }

    // サイトの所有者を確認
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('user_id, line_channel_id, line_channel_secret, line_channel_access_token, line_enabled')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (site.user_id !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // GET: LINE 設定を取得（トークンはマスク）
    if (req.method === 'GET') {
      return res.status(200).json({
        lineChannelId: site.line_channel_id || '',
        lineChannelSecret: maskToken(site.line_channel_secret),
        lineChannelAccessToken: maskToken(site.line_channel_access_token),
        lineEnabled: site.line_enabled ?? false,
        // トークンが設定されているかどうかのフラグ
        hasChannelSecret: !!site.line_channel_secret,
        hasChannelAccessToken: !!site.line_channel_access_token,
      });
    }

    // PUT: LINE 設定を更新
    if (req.method === 'PUT') {
      const {
        lineChannelId,
        lineChannelSecret,
        lineChannelAccessToken,
        lineEnabled,
      } = req.body;

      const updateData: Record<string, any> = {};

      // チャネルID は常に更新
      if (lineChannelId !== undefined) {
        updateData.line_channel_id = lineChannelId || null;
      }

      // シークレットとアクセストークンは、マスクされた値でない場合のみ更新
      // （クライアントがマスクされた値をそのまま送り返すことがあるため）
      if (lineChannelSecret !== undefined && !lineChannelSecret.includes('****')) {
        updateData.line_channel_secret = lineChannelSecret || null;
      }

      if (lineChannelAccessToken !== undefined && !lineChannelAccessToken.includes('****')) {
        updateData.line_channel_access_token = lineChannelAccessToken || null;
      }

      // 有効フラグ
      if (lineEnabled !== undefined) {
        updateData.line_enabled = Boolean(lineEnabled);
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }

      const { error: updateError } = await supabaseClient
        .from('sites')
        .update(updateData)
        .eq('id', siteId);

      if (updateError) {
        console.error('[LINE Config API] Update error:', updateError);
        return res.status(500).json({ message: 'Failed to update LINE config' });
      }

      // 更新後の設定を取得して返す
      const { data: updatedSite } = await supabaseClient
        .from('sites')
        .select('line_channel_id, line_channel_secret, line_channel_access_token, line_enabled')
        .eq('id', siteId)
        .single();

      return res.status(200).json({
        lineChannelId: updatedSite?.line_channel_id || '',
        lineChannelSecret: maskToken(updatedSite?.line_channel_secret),
        lineChannelAccessToken: maskToken(updatedSite?.line_channel_access_token),
        lineEnabled: updatedSite?.line_enabled ?? false,
        hasChannelSecret: !!updatedSite?.line_channel_secret,
        hasChannelAccessToken: !!updatedSite?.line_channel_access_token,
        message: 'LINE config updated successfully',
      });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return res.status(401).json({
        message: 'Unauthorized',
        error: '認証が必要です',
      });
    }

    console.error('[LINE Config API] Error:', error);
    return res.status(500).json({
      message: 'Failed to process request',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
