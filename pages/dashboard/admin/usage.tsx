import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import { createSupabaseClient } from '@/utils/supabase-auth';

interface TenantUsage {
  user_id: string;
  chat_count: number;
  embedding_tokens: number;
  training_count: number;
  total_tokens: number;
  total_cost_usd: number;
  plan: string | null;
  chat_quota: number | null;
  embedding_quota: number | null;
}

interface UsageResponse {
  month: string;
  range: {
    start: string;
    end: string;
  };
  tenants: TenantUsage[];
}

const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

function formatCurrency(value: number) {
  return `$${value.toFixed(4)}`;
}

export default function AdminUsagePage() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      setIsAdmin(ADMIN_IDS.includes(session.user.id));
      setAuthLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setError('このページへのアクセス権限がありません');
      setLoading(false);
      return;
    }

    const fetchUsage = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/admin/usage?month=${selectedMonth}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || '取得に失敗しました');
        }

        const json = (await response.json()) as UsageResponse;
        setData(json);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [authLoading, isAdmin, selectedMonth, router, supabase]);

  const totals = useMemo(() => {
    if (!data) return null;
    return data.tenants.reduce(
      (acc, tenant) => {
        acc.chat_count += tenant.chat_count;
        acc.embedding_tokens += tenant.embedding_tokens;
        acc.training_count += tenant.training_count;
        acc.total_tokens += tenant.total_tokens;
        acc.total_cost_usd += tenant.total_cost_usd;
        return acc;
      },
      {
        chat_count: 0,
        embedding_tokens: 0,
        training_count: 0,
        total_tokens: 0,
        total_cost_usd: 0,
      },
    );
  }, [data]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">認証確認中...</div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-red-500">このページへのアクセス権限がありません。</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">管理者向け使用状況</h1>
            <p className="text-gray-600 text-sm">各テナントの月次使用量・コストを確認できます。</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600" htmlFor="month">
              月を選択
            </label>
            <input
              id="month"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">読み込み中...</div>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500">総チャット回数</p>
                <p className="text-2xl font-semibold">{totals?.chat_count.toLocaleString()}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500">総埋め込みトークン</p>
                <p className="text-2xl font-semibold">{totals?.embedding_tokens.toLocaleString()}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500">総コスト（USD）</p>
                <p className="text-2xl font-semibold">{formatCurrency(totals?.total_cost_usd || 0)}</p>
              </div>
            </div>

            <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">User ID</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Plan</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Chats</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Embedding Tokens</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Training</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.tenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                        データがありません
                      </td>
                    </tr>
                  ) : (
                    data.tenants.map((tenant) => (
                      <tr key={tenant.user_id}>
                        <td className="px-3 py-2 font-mono text-xs break-all">{tenant.user_id}</td>
                        <td className="px-3 py-2">
                          {tenant.plan || '-'}
                          {tenant.chat_quota ? (
                            <span className="block text-xs text-gray-500">
                              チャット {tenant.chat_quota.toLocaleString()} / 埋め込み {tenant.embedding_quota?.toLocaleString() ?? '-'}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right">{tenant.chat_count.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{tenant.embedding_tokens.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{tenant.training_count.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(tenant.total_cost_usd)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
