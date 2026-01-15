import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Surface from '@/components/ui/Surface';
import { createSupabaseClient } from '@/utils/supabase-auth';
import Onboarding from '@/components/Onboarding';
import { InternalPlan } from '@/lib/planConfig';

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
  const [userPlan, setUserPlan] = useState<InternalPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [trainingSites, setTrainingSites] = useState<Set<string>>(new Set());
  const [trainingJobs, setTrainingJobs] = useState<Map<string, TrainingJob>>(new Map());
  const trainingJobsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trainingJobsChannelRef = useRef<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
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

  // Stripe決済完了後の案内表示制御
  useEffect(() => {
    if (!router.isReady) return;

    const localKey = 'recent_payment_success';

    const setFlagFromLocalStorage = () => {
      if (typeof window === 'undefined') return;
      const stored = window.localStorage.getItem(localKey);
      if (stored === 'true') {
        setPaymentSuccess(true);
      }
    };

    if (router.query.payment === 'success') {
      setPaymentSuccess(true);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(localKey, 'true');
      }

      const newQuery = { ...router.query };
      delete newQuery.payment;
      delete newQuery.session_id;

      router.replace({ pathname: router.pathname, query: newQuery }, undefined, {
        shallow: true,
      });
    } else {
      setFlagFromLocalStorage();
    }
  }, [router]);

  // ユーザープラン取得（サブスク誘導表示用）
  useEffect(() => {
    if (authLoading) return;

    let isMounted = true;

    const ensureUserPlan = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (isMounted) {
          setUserPlan(null);
          setPlanLoading(false);
        }
        return;
      }

      try {
        setPlanLoading(true);
        const { data, error } = await supabase
          .from('users')
          .select('plan')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (data?.plan) {
          if (isMounted) {
            setUserPlan(data.plan as InternalPlan);
          }
          return;
        }

        const { data: newUser } = await supabase
          .from('users')
          .insert({
            id: session.user.id,
            plan: 'pending',
            chat_quota: 0,
            embedding_quota: 0,
          })
          .select('plan')
          .single();

        if (isMounted) {
          setUserPlan((newUser?.plan as InternalPlan) ?? 'pending');
        }
      } catch (error) {
        console.error('Error fetching user plan:', error);
      } finally {
        if (isMounted) {
          setPlanLoading(false);
        }
      }
    };

    ensureUserPlan();

    return () => {
      isMounted = false;
    };
  }, [authLoading, supabase]);

  const loadTrainingJobs = useCallback(async (trainingSet: Set<string>) => {
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
  }, [supabase]);

  const fetchSites = useCallback(async () => {
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

      const training = new Set<string>(data.filter((s) => s.status === 'training').map((s) => s.id));
      setTrainingSites(training);

      await loadTrainingJobs(training);
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  }, [loadTrainingJobs, router, supabase]);

  // サイト一覧を取得
  useEffect(() => {
    if (authLoading) return;

    fetchSites();

    const setupRealtime = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

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
            if (process.env.NODE_ENV === 'development') {
              console.log('[Realtime] Sites table changed, fetching sites...', payload);
            }
            fetchSites();
          }
        )
        .subscribe((status: any) => {
          if (process.env.NODE_ENV === 'development') {
            if (status === 'SUBSCRIBED') {
              console.log('[Realtime] Sites channel subscribed');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('[Realtime] Sites channel error');
            } else {
              console.log('[Realtime] Sites channel status:', status);
            }
          } else if (status === 'CHANNEL_ERROR') {
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
  }, [authLoading, fetchSites, supabase]);

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
  }, [loadTrainingJobs, trainingSites]);

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
  }, [fetchSites, supabase, trainingSites]);

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
      idle: 'border-premium-stroke/40 bg-premium-surface/70 text-premium-muted',
      training: 'border-emerald-400/30 bg-emerald-400/15 text-premium-accent animate-pulse',
      ready: 'border-emerald-400/40 bg-emerald-500/20 text-premium-accent',
      error: 'border-rose-400/40 bg-rose-500/20 text-rose-600',
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

  const renderUserSiteActions = (site: Site) => {
    const isReady = site.status === 'ready';
    const isTraining = site.status === 'training';
    const timeline = [
      { label: 'URL登録完了', done: true },
      { label: 'WEBGPTが学習', done: isTraining || isReady },
      { label: 'チャットを埋め込んで公開', done: isReady },
    ];

    const statusMessage = isReady
      ? '学習が完了しました。埋め込みコードを貼るとそのままチャットを稼働できます。'
      : isTraining
      ? '運営がURLをもとに学習を進めています。完了するとメールとダッシュボードでお知らせします。'
      : 'WEBGPTチームが順次学習を開始します。追加URLがあればサポートまでお知らせください。';

    return (
      <div className="mt-6 space-y-3">
        <Card className="space-y-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-premium-text">
              {isReady ? 'チャットを公開する準備ができました' : '現在のステータス: ' + STATUS_LABELS[site.status]}
            </p>
            <p className="mt-1 text-xs text-premium-muted">{statusMessage}</p>
          </div>
          {isReady && site?.id && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="md" onClick={() => router.push(`/dashboard/sites/${site.id}/embed`)}>
                埋め込みコードを見る
              </Button>
              <Button
                size="md"
                variant="secondary"
                onClick={() => router.push(`/dashboard/${site.id}`)}
              >
                この場でチャットをテスト
              </Button>
              <Button
                size="md"
                variant="secondary"
                onClick={() => {
                  if (site?.id) {
                    router.push(`/dashboard/${site.id}/insights`);
                  }
                }}
              >
                質問インサイト
              </Button>
            </div>
          )}
        </Card>
        <Card className="space-y-2 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-premium-muted">Progress</p>
          <ol className="space-y-2 text-xs text-premium-muted">
            {timeline.map((step, idx) => (
              <li key={step.label} className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${step.done ? 'bg-premium-accent' : 'bg-premium-stroke/60'}`}
                />
                <span className={step.done ? 'text-premium-text' : undefined}>{idx + 1}. {step.label}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    );
  };

  const recentSite = [...sites].filter((s) => s.last_trained_at).sort((a, b) => {
    if (!a.last_trained_at || !b.last_trained_at) return 0;
    return (new Date(b.last_trained_at).getTime() - new Date(a.last_trained_at).getTime());
  })[0];
  const lastTrainedLabel = recentSite?.last_trained_at
    ? formatDate(recentSite.last_trained_at)
    : '-';

  const hasReadySite = sites.some((site) => site.status === 'ready');
  const readySite = sites.find((site) => site.status === 'ready');
  const heroStats = [
    { label: '総サイト数', value: sites.length },
    { label: '学習中', value: trainingSites.size, accent: true },
    { label: '最終学習', value: lastTrainedLabel },
  ];

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-full border border-premium-stroke/40 bg-premium-surface/70 px-6 py-3 text-sm uppercase tracking-[0.2em] text-premium-muted">
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
      <Surface className="relative mx-auto max-w-6xl overflow-hidden px-4 py-6 text-premium-text shadow-[0_45px_120px_rgba(1,8,4,0.65)] sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 right-12 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-teal-400/10 blur-[140px]" />
        </div>
        <div className="relative z-10">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-premium-muted/80">Control Panel</p>
                <h1 className="text-3xl font-semibold text-premium-text">ダッシュボード</h1>
              </div>
              <p className="text-sm text-premium-muted">
                学習状況と契約ステータスを一元管理できます。Clarity を優先し、重要な指標のみ表示しています。
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-premium-muted">
                <div className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-premium-accent" />
                  <span>学習中 {trainingSites.size} 件</span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <span className="text-premium-muted/60">最終学習</span>
                  <span className="font-medium text-premium-text">{lastTrainedLabel}</span>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end md:max-w-md">
              <Button
                variant="secondary"
                size="md"
                className="w-full sm:w-auto"
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push('/auth/login');
                }}
              >
                ログアウト
              </Button>
              <Button
                id="onboarding-create-site-btn"
                size="md"
                className="w-full sm:w-auto"
                onClick={() => setShowModal(true)}
              >
                + 新規サイト登録
              </Button>
            </div>
          </div>

          <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="主要指標">
            {heroStats.map((stat) => (
              <Card key={stat.label} className="relative overflow-hidden px-5 py-4">
                <div className="absolute inset-0 opacity-50">
                  {stat.accent && (
                    <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-emerald-400/25 to-transparent blur-3xl" />
                  )}
                </div>
                <dl className="relative">
                  <dt className="text-xs uppercase tracking-[0.3em] text-premium-muted">{stat.label}</dt>
                  <dd className={`mt-3 text-3xl font-semibold ${stat.accent ? 'text-premium-accent' : 'text-premium-text'}`}>
                    {stat.value}
                  </dd>
                </dl>
              </Card>
            ))}
          </section>

          {!isAdmin && (<></>)}

          {isAdmin && (
            <div className="mb-6 flex justify-end">
              <Link
                href="/dashboard/admin/usage"
                className="inline-flex items-center gap-2 rounded-full border border-premium-stroke/50 bg-premium-surface/70 px-4 py-2 text-sm font-semibold text-premium-text transition hover:bg-premium-elevated/70"
              >
                管理者向け使用状況を見る
                <span aria-hidden>→</span>
              </Link>
            </div>
          )}

        {sites.length > 0 && !planLoading && (!userPlan || userPlan === 'pending') && (
          <div className="mb-6 rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-4 text-sm text-emerald-700 shadow-[0_25px_80px_rgba(16,185,129,0.15)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold text-premium-text">サイト登録ありがとうございます！</p>
                <p className="mt-1 text-xs text-premium-accent sm:text-sm">
                  学習着手はサブスク契約後に順次行います。アップグレードして優先的にセットアップを進めましょう。
                </p>
              </div>
              <Link
                href="/dashboard/plans"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-premium-accentDeep shadow-[0_20px_45px_rgba(255,255,255,0.25)] transition hover:-translate-y-0.5"
              >
                プランを確認する
              </Link>
            </div>
          </div>
        )}

        {sites.length > 0 &&
          !planLoading &&
          !isAdmin &&
          ((userPlan && userPlan !== 'pending') || paymentSuccess) && (
            <div className="mb-6 rounded-3xl border border-premium-stroke/50 bg-premium-surface/70 p-4 text-sm text-premium-text shadow-[0_25px_80px_rgba(15,23,42,0.45)] sm:p-5">
            <p className="text-base font-semibold text-premium-text">ご契約ありがとうございます！</p>
            <p className="mt-1 text-xs text-premium-muted sm:text-sm">
              WEBGPT チームが登録済み URL をもとにチャットボットの学習を開始します。対応完了までは管理者からのご連絡をお待ちください。
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-premium-muted">
              <li>登録内容に不足がある場合はメールで確認させていただきます</li>
              <li>学習完了後、ダッシュボードとメールで稼働開始をお知らせします</li>
              <li>お急ぎの際はサポートチャットからご連絡ください</li>
            </ul>
            <button
              onClick={() => {
                setPaymentSuccess(false);
                if (typeof window !== 'undefined') {
                  window.localStorage.removeItem('recent_payment_success');
                }
              }}
              className="mt-4 inline-flex items-center justify-center rounded-full border border-premium-stroke/60 px-4 py-1.5 text-xs font-semibold text-premium-text transition hover:border-white/40"
            >
              表示を閉じる
            </button>
          </div>
        )}

        {sites.length === 0 ? (
          <Card variant="dashed" className="px-6 py-12 text-center text-premium-muted">
            <p className="mb-4 text-base text-premium-muted">登録されているサイトがありません</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-premium-accent via-premium-accentGlow to-premium-accent px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_20px_40px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5"
            >
              最初のサイトを登録する
            </button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {sites.map((site) => (
              <Card
                key={site.id}
                className="group relative overflow-hidden p-5 shadow-[0_35px_120px_rgba(1,3,6,0.55)] transition hover:border-emerald-400/30 hover:shadow-[0_45px_140px_rgba(1,8,4,0.65)]"
              >
                <div className="pointer-events-none absolute inset-0 opacity-60">
                  <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/20 blur-[80px]" />
                </div>
                <div className="relative">
                  <div className="mb-3 flex items-start justify-between gap-2 md:mb-4">
                    <h2 className="flex-1 break-words text-lg font-semibold text-premium-text md:text-xl">
                      {site.name}
                    </h2>
                    <div className="flex-shrink-0">{getStatusBadge(site.status)}</div>
                  </div>
                  {isAdmin && (
                    <p className="mb-3 text-xs text-premium-muted">
                      所有者: {site.owner_email ?? '不明'}
                    </p>
                  )}

                  <div className="mb-4 space-y-2 text-xs text-premium-muted md:text-sm">
                    <div>
                      <span className="font-medium text-premium-muted">サイトID:</span>{' '}
                      <code className="rounded bg-premium-elevated/50 px-1.5 py-0.5 font-mono text-[10px] text-premium-accent">
                        {site.id}
                      </code>
                    </div>
                    <div>
                      <span className="font-medium text-premium-muted">URL:</span>{' '}
                      <a
                        href={site.base_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-premium-muted underline-offset-4 hover:underline"
                      >
                        {site.base_url}
                      </a>
                    </div>
                    {site.last_trained_at && (
                      <div>
                        <span className="font-medium text-premium-muted">最終学習:</span>{' '}
                        <span className="break-words text-premium-text">{formatDate(site.last_trained_at)}</span>
                      </div>
                    )}
                  </div>

                  {site.status === 'training' && (
                    <Card className="mb-4 border border-premium-stroke/40 bg-premium-surface/70 px-4 py-3 text-xs text-premium-muted md:text-sm">
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
                            <div className="mb-1 flex justify-between text-xs text-premium-muted">
                              <span className="font-medium">学習進捗</span>
                              <span>{label}</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-premium-elevated/70">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-premium-accent via-premium-accentGlow to-premium-accent transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            {!job && (
                              <p className="mt-1 text-[11px] text-premium-muted">URLリストを解析しています...</p>
                            )}
                          </div>
                        );
                      })()}
                    </Card>
                  )}

                  {isAdmin ? (
                    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                      {site.status === 'ready' && (
                        <>
                          <Link
                            id="onboarding-chat-btn"
                            href={`/dashboard/${site.id}`}
                            className="flex-1 rounded-full bg-gradient-to-r from-premium-accent via-premium-accentGlow to-premium-accent px-4 py-2.5 text-center text-sm font-semibold text-slate-900 shadow-[0_20px_40px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5"
                          >
                            チャット開始
                          </Link>
                          <button
                            onClick={() => handleStartTraining(site.id)}
                            className="flex-1 rounded-full border border-premium-stroke/40 bg-premium-surface/70 px-4 py-2.5 text-sm font-medium text-premium-text transition hover:bg-premium-elevated/70"
                          >
                            再学習
                          </button>
                        </>
                      )}
                      {site.status === 'idle' && (
                        <button
                          id="onboarding-start-training-btn"
                          onClick={() => handleStartTraining(site.id)}
                          className="flex-1 rounded-full border border-premium-stroke/40 bg-premium-surface/70 px-4 py-2.5 text-sm font-medium text-premium-text transition hover:bg-white/15"
                        >
                          学習開始
                        </button>
                      )}
                      {site.status === 'training' && (
                        <button
                          disabled
                          className="flex-1 cursor-not-allowed rounded-full border border-premium-stroke/40 bg-premium-surface/70 px-4 py-2.5 text-sm font-medium text-premium-muted"
                        >
                          学習中...
                        </button>
                      )}
                      {site.status === 'error' && (
                        <button
                          onClick={() => handleStartTraining(site.id)}
                          className="flex-1 rounded-full bg-gradient-to-r from-rose-500/80 to-orange-400/80 px-4 py-2.5 text-sm font-semibold text-premium-text shadow-[0_20px_45px_rgba(248,113,113,0.35)]"
                        >
                          再学習
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSite(site.id)}
                        className="w-full rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-500/20 sm:w-auto"
                      >
                        削除
                      </button>
                    </div>
                  ) : (
                    renderUserSiteActions(site)
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        </div>
        {/* 新規サイト登録Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-h-[90vh] max-w-md overflow-y-auto rounded-3xl border border-premium-stroke/40 bg-gradient-to-b from-[#07150f] via-[#030a08] to-[#010305] p-5 text-premium-text shadow-[0_45px_120px_rgba(1,5,3,0.75)] md:p-6">
              <h2 className="mb-4 text-xl font-semibold md:text-2xl">新規サイト登録</h2>
              <form onSubmit={handleCreateSite}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-premium-muted">サイト名 *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full rounded-2xl border border-premium-stroke/40 bg-premium-surface/70 px-4 py-2.5 text-sm text-premium-text placeholder:text-premium-muted focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                      placeholder="例: STRIX 総合型選抜塾"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-premium-muted">ベースURL *</label>
                    <input
                      type="url"
                      required
                      value={formData.baseUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, baseUrl: e.target.value })
                      }
                      className="w-full rounded-2xl border border-premium-stroke/40 bg-premium-surface/70 px-4 py-2.5 text-sm text-premium-text placeholder:text-premium-muted focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-premium-muted">サイトマップURL（オプション）</label>
                    <input
                      type="url"
                      value={formData.sitemapUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, sitemapUrl: e.target.value })
                      }
                      className="w-full rounded-2xl border border-premium-stroke/40 bg-premium-surface/70 px-4 py-2.5 text-sm text-premium-text placeholder:text-premium-muted focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                      placeholder="https://example.com/sitemap.xml"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-premium-muted">URLリスト（オプション）</label>
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
                            className="flex-1 rounded-2xl border border-premium-stroke/40 bg-premium-surface/70 px-3 py-2 text-sm text-premium-text placeholder:text-premium-muted focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                            placeholder="https://example.com/page1"
                          />
                          {index === urlInputs.length - 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setUrlInputs([...urlInputs, '']);
                              }}
                              className="flex items-center justify-center rounded-2xl border border-premium-stroke/40 bg-premium-surface/70 px-3 py-2 text-sm font-medium text-premium-text transition hover:bg-white/15"
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
                              className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-500/20"
                              aria-label="この入力フィールドを削除"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {formData.urlList.length > 0 && (
                      <div className="mb-2 max-h-40 overflow-y-auto rounded-2xl border border-premium-stroke/40 bg-premium-surface/70 p-2">
                        <div className="space-y-1">
                          {formData.urlList.map((url, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded-xl bg-premium-elevated/70 px-2 py-1 text-sm text-premium-text"
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
                                className="ml-2 text-xs text-rose-500 hover:text-rose-600"
                                aria-label="削除"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-premium-muted">
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
                    className="flex-1 rounded-full border border-premium-stroke/40 bg-premium-surface/70 px-4 py-2.5 text-sm font-medium text-premium-text transition hover:bg-white/15"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-full bg-gradient-to-r from-premium-accent via-premium-accentGlow to-premium-accent px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_20px_45px_rgba(16,185,129,0.35)]"
                  >
                    登録
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Surface>
    </Layout>
  );
}
