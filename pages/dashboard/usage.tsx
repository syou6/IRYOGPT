import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import { createSupabaseClient } from '@/utils/supabase-auth';

interface MonthlyUsage {
  chat_count: number;
  embedding_tokens: number;
  total_cost_usd: number;
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
  cost_usd: number;
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
          setMonthlyUsage(usageData[0]);
        } else {
          setMonthlyUsage({
            chat_count: 0,
            embedding_tokens: 0,
            total_cost_usd: 0,
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
          .select('created_at, action, tokens_consumed, cost_usd')
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
              cost_usd: 0,
            };

            if (log.action === 'chat') {
              existing.chat_count += 1;
            } else if (log.action === 'embedding') {
              existing.embedding_tokens += log.tokens_consumed || 0;
            }

            existing.cost_usd += parseFloat(log.cost_usd?.toString() || '0');
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
                cost_usd: 0,
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
  const maxCost = Math.max(
    ...dailyUsage.map((d) => d.cost_usd),
    0.01
  );

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block"
          >
            ← ダッシュボードに戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">使用状況</h1>
          <p className="text-gray-600 mt-2">今月の使用量とコストを確認できます</p>
        </div>

        {/* 月選択 */}
        <div className="mb-6">
          <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 mb-2">
            表示月
          </label>
          <input
            id="month-select"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* プラン情報 */}
        {user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">現在のプラン</h2>
                <p className="text-2xl font-bold text-blue-600 mt-1 capitalize">
                  {user.plan}
                </p>
              </div>
              <Link
                href="/dashboard/plans"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                プランを変更
              </Link>
            </div>
          </div>
        )}

        {/* 月間サマリー */}
        {monthlyUsage && user && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* チャット回数 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">チャット回数</h3>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {monthlyUsage.chat_count.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    / {user.chat_quota.toLocaleString()} 回
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-gray-700">
                    {chatUsagePercent.toFixed(1)}%
                  </div>
                  <div className="w-24 h-2 bg-gray-200 rounded-full mt-2">
                    <div
                      className={`h-2 rounded-full ${
                        chatUsagePercent >= 90
                          ? 'bg-red-500'
                          : chatUsagePercent >= 70
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${chatUsagePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 埋め込みトークン数 */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">埋め込みトークン数</h3>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {monthlyUsage.embedding_tokens.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    / {user.embedding_quota.toLocaleString()} トークン
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-gray-700">
                    {embeddingUsagePercent.toFixed(1)}%
                  </div>
                  <div className="w-24 h-2 bg-gray-200 rounded-full mt-2">
                    <div
                      className={`h-2 rounded-full ${
                        embeddingUsagePercent >= 90
                          ? 'bg-red-500'
                          : embeddingUsagePercent >= 70
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${embeddingUsagePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* コスト */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">今月のコスト</h3>
              <p className="text-3xl font-bold text-gray-900">
                ${monthlyUsage.total_cost_usd.toFixed(4)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                約 ¥{(monthlyUsage.total_cost_usd * 150).toFixed(2)}（1USD=150円換算）
              </p>
            </div>
          </div>
        )}

        {/* 日別グラフ */}
        {dailyUsage.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* チャット回数グラフ */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">日別チャット回数</h3>
              <div className="space-y-2">
                {dailyUsage.map((day) => {
                  const height = maxChatCount > 0
                    ? (day.chat_count / maxChatCount) * 100
                    : 0;
                  return (
                    <div key={day.date} className="flex items-end gap-2">
                      <div className="text-xs text-gray-600 w-20 text-right">
                        {new Date(day.date).getDate()}日
                      </div>
                      <div className="flex-1 bg-gray-100 rounded h-8 relative">
                        <div
                          className="bg-blue-500 rounded h-full transition-all"
                          style={{ width: `${height}%` }}
                        />
                        {day.chat_count > 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
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
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">日別埋め込みトークン数</h3>
              <div className="space-y-2">
                {dailyUsage.map((day) => {
                  const height = maxEmbeddingTokens > 0
                    ? (day.embedding_tokens / maxEmbeddingTokens) * 100
                    : 0;
                  return (
                    <div key={day.date} className="flex items-end gap-2">
                      <div className="text-xs text-gray-600 w-20 text-right">
                        {new Date(day.date).getDate()}日
                      </div>
                      <div className="flex-1 bg-gray-100 rounded h-8 relative">
                        <div
                          className="bg-green-500 rounded h-full transition-all"
                          style={{ width: `${height}%` }}
                        />
                        {day.embedding_tokens > 0 && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
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

        {/* コストグラフ */}
        {dailyUsage.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">日別コスト（USD）</h3>
            <div className="space-y-2">
              {dailyUsage.map((day) => {
                const height = maxCost > 0
                  ? (day.cost_usd / maxCost) * 100
                  : 0;
                return (
                  <div key={day.date} className="flex items-end gap-2">
                    <div className="text-xs text-gray-600 w-20 text-right">
                      {new Date(day.date).getDate()}日
                    </div>
                    <div className="flex-1 bg-gray-100 rounded h-8 relative">
                      <div
                        className="bg-purple-500 rounded h-full transition-all"
                        style={{ width: `${height}%` }}
                      />
                      {day.cost_usd > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                          ${day.cost_usd.toFixed(4)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 使用量が0の場合 */}
        {dailyUsage.length === 0 && !loading && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">
              {selectedMonth === new Date().toISOString().slice(0, 7)
                ? '今月はまだ使用量がありません'
                : 'この月の使用量はありません'}
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block text-blue-600 hover:text-blue-800"
            >
              ダッシュボードに戻る
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
