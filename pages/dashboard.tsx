import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import { createSupabaseClient } from '@/utils/supabase-auth';
import Onboarding from '@/components/Onboarding';

const MAX_TRAINING_PAGES = 20;
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

interface Site {
  id: string;
  name: string;
  base_url: string;
  sitemap_url: string | null;
  status: 'idle' | 'training' | 'ready' | 'error';
  last_trained_at: string | null;
  created_at: string;
  user_id?: string;
  owner_email?: string | null;
}

const STATUS_LABELS: Record<Site['status'], string> = {
  idle: '未学習',
  training: '学習中',
  ready: '準備完了',
  error: 'エラー',
};

interface TrainingJob {
  id: string;
  site_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  finished_at: string | null;
  total_pages: number | null;
  processed_pages: number | null;
  error_message: string | null;
  metadata?: {
    detected_sitemap_url?: string | null;
    detection_method?: string;
    url_count?: number;
    urls?: string[];
    original_url_count?: number;
    page_limit?: {
      max_pages: number;
      truncated: boolean;
    };
  };
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: '',
    sitemapUrl: '',
    urlList: [] as string[],
  });
  const [urlInputs, setUrlInputs] = useState(['']);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(ADMIN_EMAILS.length === 0);
  const [trainingSites, setTrainingSites] = useState<Set<string>>(new Set());
  const [trainingJobs, setTrainingJobs] = useState<Map<string, TrainingJob>>(new Map());
  const trainingJobsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trainingJobsChannelRef = useRef<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const supabase = createSupabaseClient();
  const channelRef = useRef<any>(null);

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
      const normalizedMail = session.user.email?.toLowerCase() ?? '';
      setUserEmail(session.user.email ?? null);
      setIsAdmin(ADMIN_EMAILS.length === 0 ? true : ADMIN_EMAILS.includes(normalizedMail));
      setAuthLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  // オンボーディング表示チェック
  useEffect(() => {
    if (authLoading) return;

    const checkOnboarding = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const completed = localStorage.getItem(`onboarding_completed_${session.user.id}`);
      if (completed !== 'true') {
        // サイトが0件の場合のみオンボーディングを表示
        const response = await fetch('/api/sites', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.length === 0) {
            setShowOnboarding(true);
          }
        }
      }
    };

    checkOnboarding();
  }, [authLoading, supabase]);

  // サイト一覧を取得
  useEffect(() => {
    if (authLoading) return;

    const fetchSitesWithAuth = async () => {
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

        const data: Site[] = await response.json();
        setSites(data);

        // Training中のサイトを追跡
        const training = new Set<string>(
          data.filter((s: Site) => s.status === 'training').map((s: Site) => s.id)
        );
        setTrainingSites(training);

        await loadTrainingJobs(training);
      } catch (error) {
        console.error('Error fetching sites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSitesWithAuth();

    // Supabase Realtimeでsitesテーブルの変更を監視
    const setupRealtime = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      // 既存のチャンネルを削除
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel('sites-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sites',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload: any) => {
            // サイトの変更を検知したら再取得
            if (process.env.NODE_ENV === 'development') {
              console.log('[Realtime] Sites table changed, fetching sites...', payload);
            }
            fetchSitesWithAuth();
          }
        )
        .subscribe((status: any) => {
          // デバッグ用: チャンネルの接続状態をログ出力（開発環境のみ）
          if (process.env.NODE_ENV === 'development') {
            if (status === 'SUBSCRIBED') {
              console.log('[Realtime] Sites channel subscribed');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('[Realtime] Sites channel error');
            } else {
              console.log('[Realtime] Sites channel status:', status);
            }
          } else if (status === 'CHANNEL_ERROR') {
            // 本番環境でもエラーは記録
            console.error('[Realtime] Sites channel error');
          }
        });
    };

    setupRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [authLoading, router, supabase]);

  const fetchSites = async () => {
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
      if (!response.ok) throw new Error('Failed to fetch sites');
      const data: Site[] = await response.json();
      setSites(data);
      
      // Training中のサイトを追跡
      const training = new Set<string>(
        data.filter((s: Site) => s.status === 'training').map((s: Site) => s.id)
      );
      setTrainingSites(training);
      await loadTrainingJobs(training);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  async function loadTrainingJobs(trainingSet: Set<string>) {
    const siteIds = Array.from(trainingSet);

    if (siteIds.length === 0) {
      setTrainingJobs(new Map());
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return;
    }

    try {
      const token = session.access_token;
      const jobEntries = await Promise.all(
        siteIds.map(async (siteId) => {
          try {
            const resp = await fetch(`/api/training-jobs/${siteId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (!resp.ok) {
              return null;
            }
            const jobs: TrainingJob[] = await resp.json();
            if (!jobs || jobs.length === 0) {
              return null;
            }
            return [siteId, jobs[0]] as const;
          } catch (error) {
            console.error('Error fetching training job:', error);
            return null;
          }
        }),
      );

      const jobMap = new Map<string, TrainingJob>();
      for (const entry of jobEntries) {
        if (entry) {
          jobMap.set(entry[0], entry[1]);
        }
      }
      setTrainingJobs(jobMap);
    } catch (error) {
      console.error('Error loading training jobs:', error);
    }
  }

  useEffect(() => {
    if (trainingJobsIntervalRef.current) {
      clearInterval(trainingJobsIntervalRef.current);
      trainingJobsIntervalRef.current = null;
    }

    if (trainingSites.size === 0) {
      setTrainingJobs(new Map());
      return;
    }

    const interval = setInterval(() => {
      loadTrainingJobs(trainingSites);
    }, 2000);
    trainingJobsIntervalRef.current = interval;

    // 初期ロード
    loadTrainingJobs(trainingSites);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [trainingSites]);

  const trainingSitesKey = Array.from(trainingSites).sort().join(',');

  useEffect(() => {
    const setupTrainingJobsRealtime = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (trainingJobsChannelRef.current) {
        supabase.removeChannel(trainingJobsChannelRef.current);
        trainingJobsChannelRef.current = null;
      }

      if (!session) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Realtime] Training jobs channel: No session, skipping');
        }
        return;
      }

      if (trainingSites.size === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[Realtime] Training jobs channel: No training sites, skipping');
        }
        return;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Realtime] Setting up training jobs channel for ${trainingSites.size} site(s)`);
      }

      trainingJobsChannelRef.current = supabase
        .channel(`training-jobs-changes-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'training_jobs',
          },
          (payload: any) => {
            const job = payload.new as TrainingJob | null;
            if (job && trainingSites.has(job.site_id)) {
              setTrainingJobs((prev) => {
                const next = new Map(prev);
                next.set(job.site_id, job);
                return next;
              });
              
              // training_jobsがcompletedになったらsitesを再取得してstatus='ready'を反映
              if (job.status === 'completed') {
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[Realtime] Training job completed for site ${job.site_id}, fetching sites...`);
                }
                fetchSites();
              }
            }
          },
        )
        .subscribe((status: any) => {
          // デバッグ用: チャンネルの接続状態をログ出力（開発環境のみ）
          if (process.env.NODE_ENV === 'development') {
            if (status === 'SUBSCRIBED') {
              console.log('[Realtime] Training jobs channel subscribed');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('[Realtime] Training jobs channel error');
            }
          } else if (status === 'CHANNEL_ERROR') {
            // 本番環境でもエラーは記録
            console.error('[Realtime] Training jobs channel error');
          }
        });
    };

    setupTrainingJobsRealtime();

    return () => {
      if (trainingJobsChannelRef.current) {
        supabase.removeChannel(trainingJobsChannelRef.current);
        trainingJobsChannelRef.current = null;
      }
    };
  }, [trainingSitesKey, supabase]);

  // 新規サイト作成
  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/auth/login');
      return;
    }

    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          baseUrl: formData.baseUrl,
          sitemapUrl: formData.sitemapUrl || null,
          urlList: formData.urlList.length > 0 ? formData.urlList.join('\n') : null,
        }),
      });
      if (!response.ok) throw new Error('Failed to create site');
      const newSite = await response.json();
      setSites([newSite, ...sites]);
      setShowModal(false);
      setFormData({ name: '', baseUrl: '', sitemapUrl: '', urlList: [] });
      setUrlInputs(['']);
    } catch (error) {
      console.error('Error creating site:', error);
      alert('サイトの作成に失敗しました');
    }
  };

  // 学習開始
  const handleStartTraining = async (siteId: string) => {
    if (!isAdmin) {
      alert('学習処理は現在、管理者が実行します。お問い合わせください。');
      return;
    }
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    if (!confirm(`「${site.name}」の学習を開始しますか？`)) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/auth/login');
      return;
    }

    try {
      const response = await fetch('/api/train/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          site_id: siteId,
          baseUrl: site.base_url,
          sitemapUrl: site.sitemap_url,
          urlList: (site as any).url_list ? String((site as any).url_list) : null,
        }),
      });
      if (!response.ok) throw new Error('Failed to start training');
      const trainingResponse = await response.json();
      
      // ステータスを更新
      setSites((prev) =>
        prev.map((s) =>
          s.id === siteId ? { ...s, status: 'training' as const } : s
        )
      );
      setTrainingSites((prev) => new Set(prev).add(siteId));

      if (trainingResponse?.job_id) {
        setTrainingJobs((prev) => {
          const next = new Map(prev);
          next.set(siteId, {
            id: trainingResponse.job_id,
            site_id: siteId,
            status: 'pending',
            started_at: new Date().toISOString(),
            finished_at: null,
            total_pages: 0,
            processed_pages: 0,
            error_message: null,
            metadata: {
              page_limit: {
                max_pages: trainingResponse.page_limit_max || MAX_TRAINING_PAGES,
                truncated: false,
              },
            },
            created_at: new Date().toISOString(),
          });
          return next;
        });
      }
      
      // 5秒後に再取得
      setTimeout(() => fetchSites(), 5000);
    } catch (error) {
      console.error('Error starting training:', error);
      alert('学習の開始に失敗しました');
    }
  };

  // サイト削除
  const handleDeleteSite = async (siteId: string) => {
    if (!isAdmin) {
      alert('削除は管理者のみが実行できます。');
      return;
    }
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    if (!confirm(`「${site.name}」を削除しますか？\n関連するデータもすべて削除されます。`)) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/auth/login');
      return;
    }

    try {
      const response = await fetch(`/api/sites/${siteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete site');
      setSites((prev) => prev.filter((s) => s.id !== siteId));
    } catch (error) {
      console.error('Error deleting site:', error);
      alert('サイトの削除に失敗しました');
    }
  };

  // ステータスバッジのスタイル
  const getStatusBadge = (status: Site['status']) => {
    const styles = {
      idle: 'border-white/10 bg-white/5 text-slate-200',
      training: 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100 animate-pulse',
      ready: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100',
      error: 'border-rose-400/40 bg-rose-500/20 text-rose-100',
    } as const;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${styles[status]}`}
      >
        {STATUS_LABELS[status]}
      </span>
    );
  };

  // 日付フォーマット
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const recentSite = [...sites].filter((s) => s.last_trained_at).sort((a, b) => {
    if (!a.last_trained_at || !b.last_trained_at) return 0;
    return (new Date(b.last_trained_at).getTime() - new Date(a.last_trained_at).getTime());
  })[0];
  const lastTrainedLabel = recentSite?.last_trained_at
    ? formatDate(recentSite.last_trained_at)
    : '-';

  const heroStats = [
    { label: '総サイト数', value: sites.length },
    { label: '学習中', value: trainingSites.size, accent: true },
    { label: '最終学習', value: lastTrainedLabel },
  ];

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.2em] text-slate-200">
            読み込み中...
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {showOnboarding && (
        <Onboarding
          onComplete={() => {
            setShowOnboarding(false);
          }}
        />
      )}
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-white/5 px-4 py-6 text-slate-100 shadow-[0_45px_120px_rgba(1,8,4,0.65)] backdrop-blur-2xl sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 right-12 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-teal-400/10 blur-[140px]" />
        </div>
        <div className="relative z-10">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">Control Panel</p>
              <h1 className="text-2xl font-semibold text-white md:text-3xl">ダッシュボード</h1>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/auth/login');
                }}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
              >
                ログアウト
              </button>
              <button
                id="onboarding-create-site-btn"
                onClick={() => setShowModal(true)}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-5 py-2 text-sm font-semibold text-slate-900 shadow-[0_25px_45px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5"
              >
                + 新規サイト登録
              </button>
            </div>
          </div>

          <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {heroStats.map((stat) => (
              <div
                key={stat.label}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl"
              >
                <div className="absolute inset-0 opacity-60">
                  {stat.accent && (
                    <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-emerald-400/25 to-transparent blur-3xl" />
                  )}
                </div>
                <div className="relative">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{stat.label}</p>
                  <p className={`mt-2 text-2xl font-semibold ${stat.accent ? 'text-emerald-200' : 'text-white'}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </section>

          {!isAdmin && (
            <div className="mb-8 rounded-3xl border border-dashed border-white/15 bg-white/5 px-5 py-4 text-sm text-slate-200">
              <p>
                現在、チャットボットの学習と埋め込み設定は SiteGPT チームが代行します。必要な URL を登録しておくだけで大丈夫です。
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {userEmail ? `ログイン中: ${userEmail}` : 'ログインユーザー情報を取得しています…'} / 学習は順次対応します。
              </p>
            </div>
          )}

        {sites.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center text-slate-300">
            <p className="mb-4 text-base text-slate-200">登録されているサイトがありません</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_20px_40px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5"
            >
              最初のサイトを登録する
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {sites.map((site) => (
              <div
                key={site.id}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_35px_120px_rgba(1,3,6,0.55)] transition hover:border-emerald-400/30 hover:shadow-[0_45px_140px_rgba(1,8,4,0.65)] backdrop-blur-xl"
              >
                <div className="pointer-events-none absolute inset-0 opacity-60">
                  <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/20 blur-[80px]" />
                </div>
                <div className="relative">
                  <div className="mb-3 flex items-start justify-between gap-2 md:mb-4">
                    <h2 className="flex-1 break-words text-lg font-semibold text-white md:text-xl">
                      {site.name}
                    </h2>
                    <div className="flex-shrink-0">{getStatusBadge(site.status)}</div>
                  </div>
                  {isAdmin && (
                    <p className="mb-3 text-xs text-slate-400">
                      所有者: {site.owner_email ?? '不明'}
                    </p>
                  )}

                  <div className="mb-4 space-y-2 text-xs text-slate-300 md:text-sm">
                    <div>
                      <span className="font-medium text-slate-200">URL:</span>{' '}
                      <a
                        href={site.base_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-emerald-200 underline-offset-4 hover:underline"
                      >
                        {site.base_url}
                      </a>
                    </div>
                    {site.last_trained_at && (
                      <div>
                        <span className="font-medium text-slate-200">最終学習:</span>{' '}
                        <span className="break-words text-slate-100">{formatDate(site.last_trained_at)}</span>
                      </div>
                    )}
                  </div>

                  {site.status === 'training' && (
                    <div className="mb-4 text-xs text-slate-200 md:text-sm">
                      {(() => {
                        const job = trainingJobs.get(site.id);
                        const processedPages = job?.processed_pages || 0;
                        const inferredTotal = job?.total_pages || job?.metadata?.url_count || MAX_TRAINING_PAGES;
                        const totalPages = inferredTotal || MAX_TRAINING_PAGES;
                        const progressPercent = totalPages
                          ? Math.min(100, (processedPages / totalPages) * 100)
                          : 0;
                        const label = job
                          ? `${processedPages} / ${totalPages}`
                          : 'URL解析中...';
                        return (
                          <div>
                            <div className="mb-1 flex justify-between text-xs text-slate-300">
                              <span className="font-medium">学習進捗</span>
                              <span>{label}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-white/10">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            {!job && (
                              <p className="mt-1 text-[11px] text-slate-400">URLリストを解析しています...</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {isAdmin ? (
                    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                      {site.status === 'ready' && (
                        <>
                          <Link
                            id="onboarding-chat-btn"
                            href={`/dashboard/${site.id}`}
                            className="flex-1 rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-900 shadow-[0_20px_40px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5"
                          >
                            チャット開始
                          </Link>
                          <button
                            onClick={() => handleStartTraining(site.id)}
                            className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                          >
                            再学習
                          </button>
                        </>
                      )}
                      {site.status === 'idle' && (
                        <button
                          id="onboarding-start-training-btn"
                          onClick={() => handleStartTraining(site.id)}
                          className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                        >
                          学習開始
                        </button>
                      )}
                      {site.status === 'training' && (
                        <button
                          disabled
                          className="flex-1 cursor-not-allowed rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-400"
                        >
                          学習中...
                        </button>
                      )}
                      {site.status === 'error' && (
                        <button
                          onClick={() => handleStartTraining(site.id)}
                          className="flex-1 rounded-full bg-gradient-to-r from-rose-500/80 to-orange-400/80 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(248,113,113,0.35)]"
                        >
                          再学習
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSite(site.id)}
                        className="w-full rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 sm:w-auto"
                      >
                        削除
                      </button>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-3">
                      {site.status === 'ready' && (
                        <Link
                          id="onboarding-chat-btn"
                          href={`/dashboard/${site.id}`}
                          className="block rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-900 shadow-[0_20px_40px_rgba(16,185,129,0.35)]"
                        >
                          チャット開始
                        </Link>
                      )}
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                        <p>学習作業は運営が対応します。完了次第ご連絡します。</p>
                        <p className="mt-1 text-xs text-slate-400">現在のステータス：{STATUS_LABELS[site.status]}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 新規サイト登録Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-h-[90vh] max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-b from-[#07150f] via-[#030a08] to-[#010305] p-5 text-slate-100 shadow-[0_45px_120px_rgba(1,5,3,0.75)] md:p-6">
              <h2 className="mb-4 text-xl font-semibold md:text-2xl">新規サイト登録</h2>
              <form onSubmit={handleCreateSite}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">サイト名 *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                      placeholder="例: STRIX 総合型選抜塾"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">ベースURL *</label>
                    <input
                      type="url"
                      required
                      value={formData.baseUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, baseUrl: e.target.value })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">サイトマップURL（オプション）</label>
                    <input
                      type="url"
                      value={formData.sitemapUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, sitemapUrl: e.target.value })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                      placeholder="https://example.com/sitemap.xml"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">URLリスト（オプション）</label>
                    <div className="mb-2 space-y-2">
                      {urlInputs.map((urlInput, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="url"
                            value={urlInput}
                            onChange={(e) => {
                              const newInputs = [...urlInputs];
                              newInputs[index] = e.target.value;
                              setUrlInputs(newInputs);
                            }}
                            onBlur={() => {
                              const trimmedUrl = urlInput.trim();
                              if (
                                trimmedUrl &&
                                (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) &&
                                !formData.urlList.includes(trimmedUrl)
                              ) {
                                setFormData({
                                  ...formData,
                                  urlList: [...formData.urlList, trimmedUrl],
                                });
                                const newInputs = [...urlInputs];
                                newInputs[index] = '';
                                setUrlInputs(newInputs);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmedUrl = urlInput.trim();
                                if (
                                  trimmedUrl &&
                                  (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) &&
                                  !formData.urlList.includes(trimmedUrl)
                                ) {
                                  setFormData({
                                    ...formData,
                                    urlList: [...formData.urlList, trimmedUrl],
                                  });
                                  const newInputs = [...urlInputs];
                                  newInputs[index] = '';
                                  setUrlInputs(newInputs);
                                }
                              }
                            }}
                            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                            placeholder="https://example.com/page1"
                          />
                          {index === urlInputs.length - 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setUrlInputs([...urlInputs, '']);
                              }}
                              className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                              aria-label="URL入力フィールドを追加"
                            >
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                            </button>
                          )}
                          {urlInputs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newInputs = urlInputs.filter((_, i) => i !== index);
                                setUrlInputs(newInputs.length > 0 ? newInputs : ['']);
                              }}
                              className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20"
                              aria-label="この入力フィールドを削除"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {formData.urlList.length > 0 && (
                      <div className="mb-2 max-h-40 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-2">
                        <div className="space-y-1">
                          {formData.urlList.map((url, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-xl bg-white/10 px-2 py-1 text-sm text-white"
                            >
                              <span className="flex-1 truncate font-mono text-xs">{url}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    urlList: formData.urlList.filter((_, i) => i !== index),
                                  });
                                }}
                                className="ml-2 text-xs text-rose-200 hover:text-rose-100"
                                aria-label="削除"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      サイトマップURLより優先されます。「+」ボタンで入力フィールドを追加できます。
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setFormData({ name: '', baseUrl: '', sitemapUrl: '', urlList: [] });
                      setUrlInputs(['']);
                    }}
                    className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/15"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_20px_45px_rgba(16,185,129,0.35)]"
                  >
                    登録
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  </Layout>
  );
}
