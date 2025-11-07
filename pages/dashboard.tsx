import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/layout';
import Link from 'next/link';
import { createSupabaseClient } from '@/utils/supabase-auth';
import Onboarding from '@/components/Onboarding';

interface Site {
  id: string;
  name: string;
  base_url: string;
  sitemap_url: string | null;
  status: 'idle' | 'training' | 'ready' | 'error';
  last_trained_at: string | null;
  created_at: string;
}

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
  const [trainingSites, setTrainingSites] = useState<Set<string>>(new Set());
  const [trainingJobs, setTrainingJobs] = useState<Map<string, TrainingJob>>(new Map());
  const trainingJobsIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
          (payload) => {
            // サイトの変更を検知したら再取得
            fetchSitesWithAuth();
          }
        )
        .subscribe();
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
    }, 5000);
    trainingJobsIntervalRef.current = interval;

    // 初期ロード
    loadTrainingJobs(trainingSites);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [Array.from(trainingSites).sort().join(',')]);

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
      
      // ステータスを更新
      setSites((prev) =>
        prev.map((s) =>
          s.id === siteId ? { ...s, status: 'training' as const } : s
        )
      );
      setTrainingSites((prev) => new Set(prev).add(siteId));
      
      // 5秒後に再取得
      setTimeout(() => fetchSites(), 5000);
    } catch (error) {
      console.error('Error starting training:', error);
      alert('学習の開始に失敗しました');
    }
  };

  // サイト削除
  const handleDeleteSite = async (siteId: string) => {
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
      idle: 'bg-gray-100 text-gray-800',
      training: 'bg-blue-100 text-blue-800 animate-pulse',
      ready: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
    };
    const labels = {
      idle: '未学習',
      training: '学習中',
      ready: '準備完了',
      error: 'エラー',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // 日付フォーマット
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP');
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">読み込み中...</div>
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
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">ダッシュボード</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/auth/login');
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium text-sm md:text-base"
            >
              ログアウト
            </button>
            <button
              id="onboarding-create-site-btn"
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm md:text-base"
            >
              + 新規サイト登録
            </button>
          </div>
        </div>

        {sites.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500 mb-4">登録されているサイトがありません</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              最初のサイトを登録する
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {sites.map((site) => (
              <div
                key={site.id}
                className="bg-white rounded-lg shadow-md p-4 md:p-6 border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-3 md:mb-4 gap-2">
                  <h2 className="text-lg md:text-xl font-semibold text-gray-900 flex-1 break-words">
                    {site.name}
                  </h2>
                  <div className="flex-shrink-0">{getStatusBadge(site.status)}</div>
                </div>

                <div className="space-y-2 mb-4 text-xs md:text-sm text-gray-600">
                  <div>
                    <span className="font-medium">URL:</span>{' '}
                    <a
                      href={site.base_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {site.base_url}
                    </a>
                  </div>
                  {site.last_trained_at && (
                    <div>
                      <span className="font-medium">最終学習:</span>{' '}
                      <span className="break-words">{formatDate(site.last_trained_at)}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  {site.status === 'ready' && (
                    <>
                      <Link
                        id="onboarding-chat-btn"
                        href={`/dashboard/${site.id}`}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium"
                      >
                        チャット開始
                      </Link>
                      <button
                        onClick={() => handleStartTraining(site.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        再学習
                      </button>
                    </>
                  )}
                  {site.status === 'idle' && (
                    <button
                      id="onboarding-start-training-btn"
                      onClick={() => handleStartTraining(site.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      学習開始
                    </button>
                  )}
                  {site.status === 'training' && (
                    <button
                      disabled
                      className="flex-1 bg-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed"
                    >
                      学習中...
                    </button>
                  )}
                  {site.status === 'error' && (
                    <button
                      onClick={() => handleStartTraining(site.id)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      再学習
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteSite(site.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium sm:w-auto w-full"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 新規サイト登録Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 md:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl md:text-2xl font-bold mb-4">新規サイト登録</h2>
              <form onSubmit={handleCreateSite}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      サイト名 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                      placeholder="例: STRIX 総合型選抜塾"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ベースURL *
                    </label>
                    <input
                      type="url"
                      required
                      value={formData.baseUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, baseUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      サイトマップURL（オプション）
                    </label>
                    <input
                      type="url"
                      value={formData.sitemapUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, sitemapUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                      placeholder="https://example.com/sitemap.xml"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URLリスト（オプション）
                    </label>
                    <div className="space-y-2 mb-2">
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
                              // 入力が完了したら、有効なURLをリストに追加
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
                                // 入力フィールドをクリア
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
                                  // 入力フィールドをクリア
                                  const newInputs = [...urlInputs];
                                  newInputs[index] = '';
                                  setUrlInputs(newInputs);
                                }
                              }
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                            placeholder="https://example.com/page1"
                          />
                          {index === urlInputs.length - 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setUrlInputs([...urlInputs, '']);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium text-sm whitespace-nowrap flex items-center justify-center"
                              aria-label="URL入力フィールドを追加"
                            >
                              <svg
                                className="w-5 h-5"
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
                                // 入力フィールドを削除
                                const newInputs = urlInputs.filter((_, i) => i !== index);
                                setUrlInputs(newInputs.length > 0 ? newInputs : ['']);
                              }}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg font-medium text-sm whitespace-nowrap"
                              aria-label="この入力フィールドを削除"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {formData.urlList.length > 0 && (
                      <div className="border border-gray-300 rounded-lg p-2 max-h-40 overflow-y-auto mb-2">
                        <div className="space-y-1">
                          {formData.urlList.map((url, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-sm"
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
                                className="ml-2 text-red-600 hover:text-red-800 text-xs"
                                aria-label="削除"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      サイトマップURLより優先されます。「+」ボタンで入力フィールドを追加できます。
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setFormData({ name: '', baseUrl: '', sitemapUrl: '', urlList: [] });
      setUrlInputs(['']);
                    }}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium text-sm md:text-base"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm md:text-base"
                  >
                    登録
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
