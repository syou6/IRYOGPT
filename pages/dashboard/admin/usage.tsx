import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
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
  training_jobs: TrainingJobSummary[];
}

interface TrainingJobSummary {
  id: string;
  site_id: string | null;
  site_name: string | null;
  user_id: string | null;
  status: string;
  processed_pages: number | null;
  estimated_cost_usd: number;
  created_at: string;
  finished_at: string | null;
}

const ADMIN_IDS = ['a8cade58-50d2-4a0a-8dfe-c9c953c591eb'];

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
        <div className="flex min-h-screen items-center justify-center text-slate-200">認証確認中...</div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center text-red-400">このページへのアクセス権限がありません。</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative mx-auto max-w-6xl px-4 py-6 text-premium-text sm:py-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] h-72 w-72 rounded-full bg-cyan-400/15 blur-[140px]" />
        </div>

        <div className="relative space-y-8">
          <div className="rounded-[32px] border border-premium-stroke bg-premium-surface p-6 shadow-[0_25px_60px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  href="/dashboard"
                  className="text-[11px] uppercase tracking-[0.35em] text-emerald-600/80"
                >
                  ← ダッシュボード
                </Link>
                <h1 className="mt-2 text-3xl font-semibold text-premium-text">管理者向け 使用状況</h1>
                <p className="mt-1 text-sm text-premium-muted">各テナントの月次使用量と概算コストをモニタリングできます</p>
              </div>
              <label className="flex flex-col text-xs font-medium uppercase tracking-[0.25em] text-premium-muted">
                表示月
                <input
                  id="month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="mt-2 rounded-full border border-premium-stroke bg-premium-surface px-4 py-2 text-base tracking-normal text-premium-text focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-[24px] border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-premium-muted">読み込み中...</div>
          ) : data ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-[28px] border border-premium-stroke bg-premium-surface p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">総チャット回数</p>
                  <p className="mt-2 text-3xl font-semibold text-premium-text">{totals?.chat_count.toLocaleString()}</p>
                </div>
                <div className="rounded-[28px] border border-premium-stroke bg-premium-surface p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">総埋め込みトークン</p>
                  <p className="mt-2 text-3xl font-semibold text-premium-text">{totals?.embedding_tokens.toLocaleString()}</p>
                </div>
                <div className="rounded-[28px] border border-premium-stroke bg-gradient-to-br from-emerald-500/10 via-cyan-400/5 to-transparent p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">総コスト（USD）</p>
                  <p className="mt-2 text-3xl font-semibold text-premium-text">{formatCurrency(totals?.total_cost_usd || 0)}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-[28px] border border-premium-stroke bg-premium-surface">
                <table className="min-w-full divide-y divide-premium-stroke text-sm">
                  <thead className="bg-premium-elevated text-premium-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">User ID</th>
                      <th className="px-3 py-2 text-left font-medium">Plan</th>
                      <th className="px-3 py-2 text-right font-medium">Chats</th>
                      <th className="px-3 py-2 text-right font-medium">Embedding Tokens</th>
                      <th className="px-3 py-2 text-right font-medium">Training</th>
                      <th className="px-3 py-2 text-right font-medium">Cost (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-premium-stroke text-premium-text">
                    {data.tenants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-premium-muted">
                          データがありません
                        </td>
                      </tr>
                    ) : (
                      data.tenants.map((tenant) => (
                        <tr key={tenant.user_id}>
                          <td className="px-3 py-2 font-mono text-xs break-all text-premium-muted">{tenant.user_id}</td>
                          <td className="px-3 py-2">
                            <p className="capitalize text-premium-text">{tenant.plan || '-'}</p>
                            {tenant.chat_quota ? (
                              <span className="text-xs text-premium-muted">
                                チャット {tenant.chat_quota.toLocaleString()} / 埋め込み {tenant.embedding_quota?.toLocaleString() ?? '-'}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right">{tenant.chat_count.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">{tenant.embedding_tokens.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">{tenant.training_count.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(tenant.total_cost_usd)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-[28px] border border-premium-stroke bg-premium-surface p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">Training Jobs</p>
                    <h2 className="text-2xl font-semibold text-premium-text">学習ジョブ履歴</h2>
                    <p className="text-sm text-premium-muted">期間中に実行された学習ジョブと概算コスト</p>
                  </div>
                  <div className="text-right text-sm text-premium-muted">
                    合計コスト:
                    <span className="ml-2 text-xl font-semibold text-emerald-600">
                      {formatCurrency(
                        data.training_jobs.reduce((sum, job) => sum + job.estimated_cost_usd, 0),
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-premium-stroke text-sm">
                    <thead className="bg-premium-elevated text-premium-muted">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Job ID</th>
                        <th className="px-3 py-2 text-left font-medium">Site</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-right font-medium">Pages</th>
                        <th className="px-3 py-2 text-right font-medium">Cost (USD)</th>
                        <th className="px-3 py-2 text-right font-medium">Started</th>
                        <th className="px-3 py-2 text-right font-medium">Finished</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-premium-stroke text-premium-text">
                      {data.training_jobs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-premium-muted">
                            対象期間の学習ジョブはありません
                          </td>
                        </tr>
                      ) : (
                        data.training_jobs.map((job) => (
                          <tr key={job.id}>
                            <td className="px-3 py-2 font-mono text-xs text-premium-muted">{job.id}</td>
                            <td className="px-3 py-2">
                              <p className="text-sm text-premium-text">{job.site_name || job.site_id || '-'}</p>
                              {job.user_id && (
                                <span className="text-xs text-premium-muted">{job.user_id}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 capitalize">{job.status}</td>
                            <td className="px-3 py-2 text-right">{job.processed_pages ?? '-'}</td>
                            <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(job.estimated_cost_usd)}</td>
                            <td className="px-3 py-2 text-right text-xs text-premium-muted">
                              {new Date(job.created_at).toLocaleString('ja-JP', { hour12: false })}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-premium-muted">
                              {job.finished_at
                                ? new Date(job.finished_at).toLocaleString('ja-JP', { hour12: false })
                                : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
