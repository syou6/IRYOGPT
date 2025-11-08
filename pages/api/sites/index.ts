import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { getAuthUser, getSupabaseAdminClient } from '@/utils/supabase-auth';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return true;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

// GET: ユーザーのサイト一覧取得
// POST: 新規サイト登録
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // 認証チェック
    const authUser = await getAuthUser(req);
    const userId = authUser.id;
    const normalizedEmail = authUser.email?.toLowerCase() ?? null;
    const adminView = isAdminEmail(normalizedEmail ?? undefined);

    if (req.method === 'GET') {
      const query = supabaseClient
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });

      if (!adminView) {
        query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (!adminView) {
        return res.status(200).json(
          data?.map((site) => ({
            ...site,
            owner_email: normalizedEmail,
          })) ?? [],
        );
      }

      const adminClient = getSupabaseAdminClient();
      const ownerMap = new Map<string, string | null>();
      const uniqueUserIds = Array.from(
        new Set(
          (data ?? [])
            .map((site) => site.user_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      await Promise.all(
        uniqueUserIds.map(async (id) => {
          try {
            const { data: userData } = await adminClient.auth.admin.getUserById(id);
            ownerMap.set(id, userData?.user?.email ?? null);
          } catch (err) {
            ownerMap.set(id, null);
          }
        }),
      );

      return res.status(200).json(
        data?.map((site) => ({
          ...site,
          owner_email: ownerMap.get(site.user_id) ?? null,
        })) ?? [],
      );
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
