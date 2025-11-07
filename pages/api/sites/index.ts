import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { requireAuth } from '@/utils/supabase-auth';

// GET: ユーザーのサイト一覧取得
// POST: 新規サイト登録
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // 認証チェック
    const userId = await requireAuth(req);

    if (req.method === 'GET') {
      const { data, error } = await supabaseClient
        .from('sites')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { name, baseUrl, sitemapUrl } = req.body;

      if (!name || !baseUrl) {
        return res.status(400).json({
          message: 'name and baseUrl are required',
        });
      }

      const { data, error } = await supabaseClient
        .from('sites')
        .insert({
          user_id: userId,
          name,
          base_url: baseUrl,
          sitemap_url: sitemapUrl || null,
          status: 'idle',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(201).json(data);
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

