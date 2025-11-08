import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseClient } from '@/utils/supabase-client';
import { requireAdmin } from '@/utils/supabase-auth';

interface UsageSummary {
  user_id: string;
  chat_count: number;
  embedding_tokens: number;
  training_count: number;
  total_tokens: number;
  total_cost_usd: number;
}

interface MonthSummary extends UsageSummary {
  plan: string | null;
  chat_quota: number | null;
  embedding_quota: number | null;
}

function parseMonth(month?: string) {
  const now = new Date();
  if (!month) {
    const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    return parseMonth(defaultMonth);
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Invalid month format. Use YYYY-MM.');
  }
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { start, end, label: month };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);

    let range;
    try {
      range = parseMonth(req.query.month as string | undefined);
    } catch (err) {
      return res.status(400).json({ message: (err as Error).message });
    }

    const { start, end, label } = range;

    const { data: logs, error: logsError } = await supabaseClient
      .from('usage_logs')
      .select('user_id, action, tokens_consumed, cost_usd')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());

    if (logsError) {
      throw logsError;
    }

    const summaryMap = new Map<string, UsageSummary>();

    (logs || []).forEach((log) => {
      if (!log.user_id) {
        return;
      }
      if (!summaryMap.has(log.user_id)) {
        summaryMap.set(log.user_id, {
          user_id: log.user_id,
          chat_count: 0,
          embedding_tokens: 0,
          training_count: 0,
          total_tokens: 0,
          total_cost_usd: 0,
        });
      }
      const entry = summaryMap.get(log.user_id)!;
      const tokens = Number(log.tokens_consumed || 0);
      const cost = Number(log.cost_usd || 0);
      entry.total_tokens += tokens;
      entry.total_cost_usd += cost;
      if (log.action === 'chat') {
        entry.chat_count += 1;
      } else if (log.action === 'embedding') {
        entry.embedding_tokens += tokens;
      } else if (log.action === 'training') {
        entry.training_count += 1;
      }
    });

    const userIds = Array.from(summaryMap.keys());
    const userMeta: Record<string, { plan: string | null; chat_quota: number | null; embedding_quota: number | null }> = {};

    if (userIds.length > 0) {
      const { data: userRows, error: userError } = await supabaseClient
        .from('users')
        .select('id, plan, chat_quota, embedding_quota')
        .in('id', userIds);

      if (userError) {
        throw userError;
      }

      userRows?.forEach((user) => {
        if (user.id) {
          userMeta[user.id] = {
            plan: user.plan,
            chat_quota: user.chat_quota,
            embedding_quota: user.embedding_quota,
          };
        }
      });
    }

    const tenants: MonthSummary[] = Array.from(summaryMap.values()).map((entry) => {
      const meta = userMeta[entry.user_id] || { plan: null, chat_quota: null, embedding_quota: null };
      return {
        ...entry,
        plan: meta.plan,
        chat_quota: meta.chat_quota,
        embedding_quota: meta.embedding_quota,
      };
    });

    return res.status(200).json({
      month: label,
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      tenants,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (error.message === 'AdminNotConfigured') {
      return res.status(500).json({ message: 'ADMIN_USER_IDS is not configured' });
    }
    if (error.message === 'Forbidden') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    console.error('[admin/usage] Error:', error);
    return res.status(500).json({
      message: 'Failed to fetch admin usage',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
