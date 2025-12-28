import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { requireAuth } from '@/utils/supabase-auth';

// PUT: サイト情報更新
// DELETE: サイト削除
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
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
      .select('user_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return res.status(404).json({ message: 'Site not found' });
    }

    if (site.user_id !== userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (req.method === 'PUT') {
      const { name, baseUrl, sitemapUrl } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (baseUrl) updateData.base_url = baseUrl;
      if (sitemapUrl !== undefined) updateData.sitemap_url = sitemapUrl || null;

      const { data, error } = await supabaseClient
        .from('sites')
        .update(updateData)
        .eq('id', siteId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      // CASCADEでdocumentsとtraining_jobsも自動削除される
      const { error } = await supabaseClient
        .from('sites')
        .delete()
        .eq('id', siteId);

      if (error) {
        throw error;
      }

      return res.status(200).json({ message: 'Site deleted successfully' });
    }

    if (req.method === 'PATCH') {
      // 部分更新（chat_mode など）
      const { chat_mode, spreadsheet_id } = req.body;

      const updateData: any = {};
      if (chat_mode !== undefined) {
        // chat_modeのバリデーション
        const validModes = ['rag_only', 'appointment_only', 'hybrid'];
        if (!validModes.includes(chat_mode)) {
          return res.status(400).json({ message: 'Invalid chat_mode' });
        }
        updateData.chat_mode = chat_mode;
      }
      if (spreadsheet_id !== undefined) {
        updateData.spreadsheet_id = spreadsheet_id || null;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }

      const { data, error } = await supabaseClient
        .from('sites')
        .update(updateData)
        .eq('id', siteId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json(data);
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return res.status(401).json({
        message: 'Unauthorized',
        error: '認証が必要です',
      });
    }

    console.error('Error:', error);
    return res.status(500).json({
      message: 'Failed to process request',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

