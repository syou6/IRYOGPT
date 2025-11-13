import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Surface from '@/components/ui/Surface';
import LoadingDots from '@/components/ui/LoadingDots';
import { createSupabaseClient } from '@/utils/supabase-auth';

interface Site {
  id: string;
  name: string;
  base_url: string;
  status: 'idle' | 'training' | 'ready' | 'error';
}

interface QuestionRanking {
  question: string;
  count: number;
  first_asked_at: string;
  last_asked_at: string;
}

interface Keyword {
  keyword: string;
  count: number;
}

interface TimelineItem {
  period_start: string;
  question_count: number;
}

interface InsightsData {
  questions: QuestionRanking[];
  keywords: Keyword[];
  timeline: TimelineItem[];
  summary: {
    thisWeek: number;
    thisMonth: number;
    total: number;
  };
}

export default function InsightsPage() {
  const router = useRouter();
  const { siteId } = router.query;
  const [site, setSite] = useState<Site | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
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

  // サイト情報を取得
  useEffect(() => {
    if (!siteId || typeof siteId !== 'string' || authLoading) return;

    const fetchSite = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      try {
        const response = await fetch('/api/sites', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to fetch sites');
        }

        const sites: Site[] = await response.json();
        const found = sites.find((s) => s.id === siteId);

        if (found) {
          setSite(found);
        } else {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error fetching site:', error);
        router.push('/dashboard');
      }
    };

    fetchSite();
  }, [siteId, router, authLoading, supabase]);

  // インサイトデータを取得
  useEffect(() => {
    if (!siteId || typeof siteId !== 'string' || authLoading || !site) return;

    const fetchInsights = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      setLoading(true);

      try {
        // 期間の計算
        const now = new Date();
        const startDate =
          period === 'week'
            ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            : period === 'month'
            ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            : null;

        // 質問ランキングを取得
        const questionsUrl = `/api/insights/questions?site_id=${siteId}&limit=10${
          startDate ? `&start_date=${startDate.toISOString()}` : ''
        }`;
        const questionsRes = await fetch(questionsUrl, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const questionsData = await questionsRes.json();

        // キーワードを取得
        const keywordsUrl = `/api/insights/keywords?site_id=${siteId}&limit=20${
          startDate ? `&start_date=${startDate.toISOString()}` : ''
        }`;
        const keywordsRes = await fetch(keywordsUrl, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const keywordsData = await keywordsRes.json();

        // 時系列データを取得
        const timelineUrl = `/api/insights/timeline?site_id=${siteId}&interval=day${
          startDate ? `&start_date=${startDate.toISOString()}` : ''
        }`;
        const timelineRes = await fetch(timelineUrl, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const timelineData = await timelineRes.json();

        // 今週と今月の質問数を計算
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const thisWeekRes = await fetch(
          `/api/insights/timeline?site_id=${siteId}&interval=day&start_date=${weekAgo.toISOString()}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        const thisWeekData = await thisWeekRes.json();
        const thisWeek =
          thisWeekData.timeline?.reduce(
            (sum: number, item: TimelineItem) => sum + item.question_count,
            0,
          ) || 0;

        const thisMonthRes = await fetch(
          `/api/insights/timeline?site_id=${siteId}&interval=day&start_date=${monthAgo.toISOString()}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        const thisMonthData = await thisMonthRes.json();
        const thisMonth =
          thisMonthData.timeline?.reduce(
            (sum: number, item: TimelineItem) => sum + item.question_count,
            0,
          ) || 0;

        setInsights({
          questions: questionsData.questions || [],
          keywords: keywordsData.keywords || [],
          timeline: timelineData.timeline || [],
          summary: {
            thisWeek,
            thisMonth,
            total: timelineData.timeline?.reduce(
              (sum: number, item: TimelineItem) => sum + item.question_count,
              0,
            ) || 0,
          },
        });
      } catch (error) {
        console.error('Error fetching insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [siteId, period, authLoading, site, supabase]);

  if (authLoading || !site) {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const maxQuestionCount = insights?.timeline.length
    ? Math.max(...insights.timeline.map((item) => item.question_count))
    : 1;

  return (
    <Layout>
      <Surface className="relative mx-auto max-w-6xl overflow-hidden px-4 py-6 text-premium-text shadow-[0_45px_120px_rgba(1,8,4,0.65)] sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 right-12 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-teal-400/10 blur-[140px]" />
        </div>

        <div className="relative z-10">
          {/* ヘッダー */}
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="mb-4 inline-flex items-center text-xs uppercase tracking-[0.35em] text-premium-muted/80 hover:text-premium-accent transition"
            >
              ← ダッシュボード
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-premium-text mb-2">
                  質問インサイト
                </h1>
                <p className="text-sm text-premium-muted">{site.name}</p>
              </div>
              <div className="flex items-center gap-3">
                {siteId && typeof siteId === 'string' && (
                  <>
                    <button
                      onClick={async () => {
                        try {
                          const {
                            data: { session },
                          } = await supabase.auth.getSession();
                          if (!session) return;

                          // エクスポートURLを生成
                          const params = new URLSearchParams({
                            site_id: siteId,
                            format: 'csv',
                          });
                          if (period === 'week') {
                            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                            params.append('start_date', weekAgo.toISOString());
                          } else if (period === 'month') {
                            const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                            params.append('start_date', monthAgo.toISOString());
                          }

                          const url = `/api/insights/export?${params.toString()}`;
                          
                          // ダウンロードを開始
                          const response = await fetch(url, {
                            headers: {
                              Authorization: `Bearer ${session.access_token}`,
                            },
                          });

                          if (!response.ok) {
                            throw new Error('エクスポートに失敗しました');
                          }

                          const blob = await response.blob();
                          const downloadUrl = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = downloadUrl;
                          a.download = `${site.name}_${new Date().toISOString().split('T')[0]}.csv`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(downloadUrl);
                        } catch (error) {
                          console.error('Export error:', error);
                          alert('エクスポートに失敗しました');
                        }
                      }}
                      className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/25 flex items-center gap-2"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      CSVエクスポート
                    </button>
                    <Link
                      href={`/dashboard/${siteId}`}
                      className="rounded-full border border-premium-stroke/40 bg-premium-surface/70 px-4 py-2 text-sm font-medium text-premium-text hover:bg-premium-surface transition"
                    >
                      チャットに戻る
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingDots color="#10b981" />
            </div>
          ) : insights ? (
            <>
              {/* 概要カード */}
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-premium-muted">今週の質問数</span>
                    <svg
                      className="h-5 w-5 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                  <div className="text-3xl font-semibold text-premium-text">
                    {insights.summary.thisWeek}
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-premium-muted">今月の質問数</span>
                    <svg
                      className="h-5 w-5 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <div className="text-3xl font-semibold text-premium-text">
                    {insights.summary.thisMonth}
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-premium-muted">総質問数</span>
                    <svg
                      className="h-5 w-5 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                  </div>
                  <div className="text-3xl font-semibold text-premium-text">
                    {insights.summary.total}
                  </div>
                </Card>
              </div>

              {/* 質問ランキング */}
              <Card className="mb-8 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-premium-text">
                    よくある質問 TOP 10
                  </h2>
                  <select
                    value={period}
                    onChange={(e) =>
                      setPeriod(e.target.value as 'week' | 'month' | 'all')
                    }
                    className="rounded-full border border-premium-stroke/40 bg-premium-surface/70 px-4 py-2 text-sm text-premium-text focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
                  >
                    <option value="week">今週</option>
                    <option value="month">今月</option>
                    <option value="all">すべて</option>
                  </select>
                </div>

                {insights.questions.length === 0 ? (
                  <div className="py-8 text-center text-sm text-premium-muted">
                    質問データがありません
                  </div>
                ) : (
                  <div className="space-y-3">
                    {insights.questions.map((q, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-4 rounded-xl border border-premium-stroke/40 bg-premium-surface/50 p-4 transition hover:bg-premium-surface/70"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-sm font-semibold text-emerald-400">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-sm text-premium-text">{q.question}</p>
                          <div className="flex items-center gap-4 text-xs text-premium-muted">
                            <span>{q.count}回</span>
                            <span>初回: {formatDate(q.first_asked_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* キーワードクラウド */}
              <Card className="mb-8 p-6">
                <h2 className="mb-4 text-xl font-semibold text-premium-text">
                  よく使われるキーワード
                </h2>

                {insights.keywords.length === 0 ? (
                  <div className="py-8 text-center text-sm text-premium-muted">
                    キーワードデータがありません
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {insights.keywords.map((kw, index) => {
                      const maxCount = Math.max(...insights.keywords.map((k) => k.count));
                      const size = Math.max(12, Math.min(20, (kw.count / maxCount) * 20 + 12));
                      return (
                        <span
                          key={index}
                          className="rounded-full border border-emerald-400/30 bg-emerald-400/20 px-3 py-1.5 text-emerald-100 transition hover:bg-emerald-400/30"
                          style={{ fontSize: `${size}px` }}
                        >
                          {kw.keyword} ({kw.count})
                        </span>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* 時系列グラフ */}
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-semibold text-premium-text">
                  質問数の推移
                </h2>

                {insights.timeline.length === 0 ? (
                  <div className="py-8 text-center text-sm text-premium-muted">
                    時系列データがありません
                  </div>
                ) : (
                  <div className="space-y-2">
                    {insights.timeline.map((item, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <span className="w-32 text-sm text-premium-muted">
                          {formatDate(item.period_start)}
                        </span>
                        <div className="relative flex-1 rounded-full bg-premium-surface/50">
                          <div
                            className="h-6 rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 transition-all"
                            style={{
                              width: `${(item.question_count / maxQuestionCount) * 100}%`,
                            }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-premium-text">
                            {item.question_count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          ) : (
            <div className="py-20 text-center text-sm text-premium-muted">
              データの取得に失敗しました
            </div>
          )}
        </div>
      </Surface>
    </Layout>
  );
}

