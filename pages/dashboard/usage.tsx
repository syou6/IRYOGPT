import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import { createSupabaseClient } from '@/utils/supabase-auth';

interface MonthlyUsage {
  chat_count: number;
  embedding_tokens: number;
}

interface User {
  id: string;
  plan: 'starter' | 'pro' | 'enterprise';
  chat_quota: number;
  embedding_quota: number;
}

interface DailyUsage {
  date: string;
  chat_count: number;
  embedding_tokens: number;
}

export default function UsagePage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState<MonthlyUsage | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const supabase = createSupabaseClient();

  // 認証チェック
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      setAuthLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  // ユーザー情報と使用量を取得
  useEffect(() => {
    if (authLoading) return;

    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      try {
        setLoading(true);

        // ユーザー情報を取得
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError || !userData) {
          // ユーザーが存在しない場合は作成
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              id: session.user.id,
              plan: 'starter',
              chat_quota: 1000,
              embedding_quota: 100000,
            })
            .select()
            .single();
          
          if (newUser) {
            setUser(newUser);
          }
        } else {
          setUser(userData);
        }

        // 月間使用量を取得
        const selectedDate = new Date(selectedMonth + '-01');
        const { data: usageData, error: usageError } = await supabase.rpc(
          'get_monthly_usage',
          {
            p_user_id: session.user.id,
            p_month: selectedDate.toISOString().slice(0, 10),
          }
        );

        if (!usageError && usageData && usageData.length > 0) {
          const { chat_count = 0, embedding_tokens = 0 } = usageData[0];
          setMonthlyUsage({ chat_count, embedding_tokens });
        } else {
          setMonthlyUsage({
            chat_count: 0,
            embedding_tokens: 0,
          });
        }

        // 日別使用量を取得（今月）
        const startOfMonth = new Date(selectedMonth + '-01');
        const endOfMonth = new Date(
          startOfMonth.getFullYear(),
          startOfMonth.getMonth() + 1,
          0
        );

        const { data: logsData, error: logsError } = await supabase
          .from('usage_logs')
          .select('created_at, action, tokens_consumed')
          .eq('user_id', session.user.id)
          .gte('created_at', startOfMonth.toISOString())
          .lte('created_at', endOfMonth.toISOString())
          .order('created_at', { ascending: true });

        if (!logsError && logsData) {
          // 日別に集計
          const dailyMap = new Map<string, DailyUsage>();

          logsData.forEach((log: any) => {
            const date = new Date(log.created_at).toISOString().slice(0, 10);
            const existing = dailyMap.get(date) || {
              date,
              chat_count: 0,
              embedding_tokens: 0,
            };

            if (log.action === 'chat') {
              existing.chat_count += 1;
            } else if (log.action === 'embedding') {
              existing.embedding_tokens += log.tokens_consumed || 0;
            }
            dailyMap.set(date, existing);
          });

          // 月の全日を埋める
          const days: DailyUsage[] = [];
          const currentDate = new Date(startOfMonth);
          while (currentDate <= endOfMonth) {
            const dateStr = currentDate.toISOString().slice(0, 10);
            days.push(
              dailyMap.get(dateStr) || {
                date: dateStr,
                chat_count: 0,
                embedding_tokens: 0,
              }
            );
            currentDate.setDate(currentDate.getDate() + 1);
          }

          setDailyUsage(days);
        }
      } catch (error) {
        console.error('Error fetching usage data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, selectedMonth, supabase, router]);

  // クォータ使用率を計算
  const chatUsagePercent = user && user.chat_quota > 0
    ? Math.min((monthlyUsage?.chat_count || 0) / user.chat_quota * 100, 100)
    : 0;

  const embeddingUsagePercent = user && user.embedding_quota > 0
    ? Math.min((monthlyUsage?.embedding_tokens || 0) / user.embedding_quota * 100, 100)
    : 0;

  // グラフの最大値を計算
  const maxChatCount = Math.max(
    ...dailyUsage.map((d) => d.chat_count),
    1
  );
  const maxEmbeddingTokens = Math.max(
    ...dailyUsage.map((d) => d.embedding_tokens),
    1
  );

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs uppercase tracking-[0.25em] text-slate-200">
            読み込み中...
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative mx-auto max-w-6xl px-4 py-6 text-slate-100 sm:py-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-emerald-500/20 to-transparent blur-3xl" />
          <div className="absolute bottom-[-20%] right-[-10%] h-72 w-72 rounded-full bg-teal-400/15 blur-[140px]" />
        </div>

        <div className="relative space-y-8">
          {/* ヘッダー */}
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_35px_120px_rgba(1,6,3,0.55)] backdrop-blur-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  href="/dashboard"
                  className="text-[11px] uppercase tracking-[0.35em] text-emerald-200/80"
                >
                  ← ダッシュボード
                </Link>
                <h1 className="mt-2 text-3xl font-semibold text-white">使用状況</h1>
                <p className="mt-1 text-sm text-slate-300">今月の利用回数とトークン消費量を確認できます</p>
              </div>
              <label className="flex flex-col text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                表示月
                <input
                  id="month-select"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="mt-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-base tracking-normal text-white shadow-inner shadow-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </label>
            </div>
          </div>

          {/* プラン情報 */}
          {user && (
            <div className="rounded-[32px] border border-white/10 bg-gradient-to-r from-emerald-500/10 via-green-400/5 to-cyan-300/10 p-6 shadow-[0_35px_120px_rgba(1,6,3,0.45)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Current Plan</p>
                  <h2 className="text-2xl font-semibold text-white capitalize">{user.plan}</h2>
                  <p className="text-sm text-slate-300">チャット {user.chat_quota.toLocaleString()} 回 / トークン {user.embedding_quota.toLocaleString()}</p>
                </div>
                <Link
                  href="/dashboard/plans"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_20px_40px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5"
                >
                  プランを変更
                </Link>
              </div>
            </div>
          )}

          {/* 月間サマリー */}
          {monthlyUsage && user && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* チャット回数 */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xs uppercase tracking-[0.3em] text-slate-400">チャット回数</h3>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-3xl font-semibold text-white">{monthlyUsage.chat_count.toLocaleString()}</p>
                  <p className="text-sm text-slate-400">/ {user.chat_quota.toLocaleString()} 回</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-emerald-200">{chatUsagePercent.toFixed(1)}%</p>
                  <div className="mt-2 h-2 w-28 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300"
                      style={{ width: `${chatUsagePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 埋め込みトークン数 */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xs uppercase tracking-[0.3em] text-slate-400">埋め込みトークン数</h3>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-3xl font-semibold text-white">{monthlyUsage.embedding_tokens.toLocaleString()}</p>
                  <p className="text-sm text-slate-400">/ {user.embedding_quota.toLocaleString()} トークン</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-emerald-200">{embeddingUsagePercent.toFixed(1)}%</p>
                  <div className="mt-2 h-2 w-28 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300"
                      style={{ width: `${embeddingUsagePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* 日別グラフ */}
        {dailyUsage.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* チャット回数グラフ */}
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">日別チャット回数</h3>
              <div className="mt-4 space-y-2">
                {dailyUsage.map((day) => {
                  const height = maxChatCount > 0
                    ? (day.chat_count / maxChatCount) * 100
                    : 0;
                  return (
                    <div key={day.date} className="flex items-end gap-2">
                      <div className="w-20 text-right text-xs text-slate-400">
                        {new Date(day.date).getDate()}日
                      </div>
                      <div className="relative h-8 flex-1 rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 transition-all"
                          style={{ width: `${height}%` }}
                        />
                        {day.chat_count > 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-900">
                            {day.chat_count}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 埋め込みトークン数グラフ */}
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">日別埋め込みトークン数</h3>
              <div className="mt-4 space-y-2">
                {dailyUsage.map((day) => {
                  const height = maxEmbeddingTokens > 0
                    ? (day.embedding_tokens / maxEmbeddingTokens) * 100
                    : 0;
                  return (
                    <div key={day.date} className="flex items-end gap-2">
                      <div className="w-20 text-right text-xs text-slate-400">
                        {new Date(day.date).getDate()}日
                      </div>
                      <div className="relative h-8 flex-1 rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 transition-all"
                          style={{ width: `${height}%` }}
                        />
                        {day.embedding_tokens > 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-900">
                            {day.embedding_tokens.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 使用量が0の場合 */}
        {dailyUsage.length === 0 && !loading && (
          <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-12 text-center text-slate-200">
            <p className="text-lg">
              {selectedMonth === new Date().toISOString().slice(0, 7)
                ? '今月はまだ使用量がありません'
                : 'この月の使用量はありません'}
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-6 py-2 text-sm font-semibold text-slate-900 shadow-[0_20px_45px_rgba(16,185,129,0.35)]"
            >
              ダッシュボードに戻る
            </Link>
          </div>
        )}
      </div>
    </div>
  </Layout>
  );
}
