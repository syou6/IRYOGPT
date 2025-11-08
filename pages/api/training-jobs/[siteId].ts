import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { getAuthUser } from '@/utils/supabase-auth';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return true;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

// GET: サイトの学習ジョブ履歴を取得
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // 認証チェック
    const authUser = await getAuthUser(req);
    const userId = authUser.id;
    const adminView = isAdminEmail(authUser.email?.toLowerCase());
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

    if (site.user_id !== userId && !adminView) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 学習ジョブ履歴を取得
    const { data, error } = await supabaseClient
      .from('training_jobs')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return res.status(200).json(data);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return res.status(401).json({
        message: 'Unauthorized',
        error: '認証が必要です',
      });
    }

    console.error('Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch training jobs',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
